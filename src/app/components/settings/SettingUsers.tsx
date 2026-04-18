import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/LanguageProvider";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { UserList } from "./UserList";
import { CreatedUserResponse, createUser, deleteUser, listUsers, resetUserPassword, User } from "../../services/authService";
import { useAuth } from "../../context/AuthContext";
import { Check, Copy } from "lucide-react";


export function SettingUsers() {
    const { t } = useI18n();
    const { user } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [newUsername, setNewUsername] = useState('');
    const [usersMessage, setUsersMessage] = useState<string | null>(null);
    const [usersError, setUsersError] = useState<string | null>(null);
    const [createdUserCredentials, setCreatedUserCredentials] = useState<{
        username: string;
        password: string;
    } | null>(null);
    const [generatedPasswordContext, setGeneratedPasswordContext] = useState<'create' | 'reset'>(
        'create',
    );
    const [isCreatedUserModalOpen, setIsCreatedUserModalOpen] = useState(false);
    const [isGeneratedPasswordCopied, setIsGeneratedPasswordCopied] = useState(false);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    const [isDeletingUser, setIsDeletingUser] = useState<number | null>(null);
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const [resetPasswordTargetId, setResetPasswordTargetId] = useState<number | null>(null);
    const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);


    const loadUsers = async () => {
        setIsLoadingUsers(true);
        try {
            const loadedUsers = await listUsers();
            setUsers(loadedUsers);
        } catch (loadError) {
            setUsersError(
                loadError instanceof Error ? loadError.message : t('settings.messages.loadFailed'),
            );
        } finally {
            setIsLoadingUsers(false);
        }
    };
    useEffect(() => {
        if (user?.username !== 'admin') {
            return;
        }

        void loadUsers();
    }, [user]);


    useEffect(() => {
        if (!createdUserCredentials || isCreatedUserModalOpen) {
            return;
        }

        if (isCreateUserOpen || resetPasswordTargetId !== null) {
            return;
        }

        const openTimer = window.setTimeout(() => {
            setIsCreatedUserModalOpen(true);
        }, 0);

        return () => window.clearTimeout(openTimer);
    }, [createdUserCredentials, isCreateUserOpen, isCreatedUserModalOpen, resetPasswordTargetId]);

    const handleCreateUser = async (event: React.FormEvent) => {
        event.preventDefault();
        setUsersMessage(null);
        setUsersError(null);
        setCreatedUserCredentials(null);
        setIsCreatingUser(true);

        try {
            if (!newUsername.trim()) {
                setUsersError(t('auth.usernameRequired'));
                setIsCreatingUser(false);
                return;
            }

            const createdUser: CreatedUserResponse = await createUser(newUsername.trim());
            void loadUsers();
            setNewUsername('');
            setIsCreateUserOpen(false);
            setUsersMessage(
                t('settings.users.userCreated', {
                    username: createdUser.username,
                }),
            );
            setCreatedUserCredentials({
                username: createdUser.username,
                password: createdUser.password,
            });
            setGeneratedPasswordContext('create');
            setIsGeneratedPasswordCopied(false);
        } catch (submitError) {
            setUsersError(
                submitError instanceof Error ? submitError.message : t('settings.messages.updateFailed'),
            );
        } finally {
            setIsCreatingUser(false);
        }
    };

    const handleDeleteUser = async (userId: number, username: string) => {
        setUsersMessage(null);
        setUsersError(null);
        setCreatedUserCredentials(null);
        setIsDeletingUser(userId);

        try {
            await deleteUser(userId);
            void loadUsers();
            setUsersMessage(t('settings.users.userDeleted', { username }));
        } catch (submitError) {
            setUsersError(
                submitError instanceof Error ? submitError.message : t('settings.messages.updateFailed'),
            );
        } finally {
            setIsDeletingUser(null);
        }
    };

    const handleResetUserPassword = async () => {
        if (!resetPasswordTargetId) return;
        setUsersError(null);
        setCreatedUserCredentials(null);
        setIsResettingPassword(true);

        try {
            const response = await resetUserPassword(resetPasswordTargetId);
            const targetUser = users.find((u) => u.id === resetPasswordTargetId);
            setResetPasswordTargetId(null);
            setUsersMessage(
                t('settings.users.passwordReset', {
                    username: targetUser?.username || 'utilisateur',
                }),
            );
            setCreatedUserCredentials({
                username: targetUser?.username || 'utilisateur',
                password: response.password,
            });
            setGeneratedPasswordContext('reset');
            setIsGeneratedPasswordCopied(false);
        } catch (submitError) {
            setUsersError(
                submitError instanceof Error ? submitError.message : t('settings.messages.updateFailed'),
            );
        } finally {
            setIsResettingPassword(false);
        }
    };

    const handleCopyGeneratedPassword = async () => {
        if (!createdUserCredentials?.password) {
            return;
        }

        try {
            await navigator.clipboard.writeText(createdUserCredentials.password);
            setIsGeneratedPasswordCopied(true);
            setTimeout(() => setIsGeneratedPasswordCopied(false), 1500);
        } catch {
            setUsersError(t('settings.messages.updateFailed'));
        }
    };

    return (
        <>
            <Card className="border-orange-500/30 bg-orange-950/15 text-white">
                <CardHeader>
                    <CardTitle className="text-orange-200">{t('settings.users.title')}</CardTitle>
                    <CardDescription className="text-orange-100/70">
                        {t('settings.users.description')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Create User Button + Dialog */}
                    <div className="flex items-center justify-between">
                        <div>
                            {usersMessage && <p className="text-sm text-emerald-300">{usersMessage}</p>}
                            {usersError && <p className="text-sm text-red-300">{usersError}</p>}
                        </div>
                        <Button
                            type="button"
                            onClick={() => {
                                setUsersMessage(null);
                                setUsersError(null);
                                setCreatedUserCredentials(null);
                                setNewUsername('');
                                setIsCreateUserOpen(true);
                            }}
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                        >
                            {t('settings.users.createNew')}
                        </Button>
                    </div>

                    <Dialog
                        open={isCreateUserOpen}
                        onOpenChange={(open) => {
                            if (!isCreatingUser) {
                                setIsCreateUserOpen(open);
                                if (!open) {
                                    setUsersError(null);
                                }
                            }
                        }}
                    >
                        <DialogContent className="border-orange-500/30 bg-slate-950 text-white">
                            <DialogHeader>
                                <DialogTitle className="text-orange-200">
                                    {t('settings.users.createNew')}
                                </DialogTitle>
                                <DialogDescription className="text-white/70">
                                    {t('settings.users.createDescription')}
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleCreateUser}>
                                <div className="space-y-4 py-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="new-username">{t('settings.users.username')}</Label>
                                        <Input
                                            id="new-username"
                                            placeholder="john_doe"
                                            value={newUsername}
                                            onChange={(e) => setNewUsername(e.target.value)}
                                            className="bg-slate-900 border-white/10 text-white"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-white/60">
                                            {t('settings.users.passwordGeneratedOnCreate')}
                                        </p>
                                    </div>
                                    {usersError && <p className="text-sm text-red-300">{usersError}</p>}
                                </div>
                                <DialogFooter className="mt-4">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setIsCreateUserOpen(false)}
                                        disabled={isCreatingUser}
                                        className="border border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                                    >
                                        {t('common.cancel')}
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={isCreatingUser}
                                        className="bg-orange-600 hover:bg-orange-700 text-white"
                                    >
                                        {isCreatingUser ? t('common.saving') : t('settings.users.create')}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <Dialog
                        open={isCreatedUserModalOpen && createdUserCredentials !== null}
                        onOpenChange={(open) => {
                            setIsCreatedUserModalOpen(open);
                            if (!open) {
                                setIsGeneratedPasswordCopied(false);
                                setCreatedUserCredentials(null);
                            }
                        }}
                    >
                        <DialogContent className="border-emerald-500/30 bg-slate-950 text-white">
                            <DialogHeader>
                                <DialogTitle className="text-emerald-200">
                                    {t('settings.users.generatedPasswordTitle')}
                                </DialogTitle>
                                <DialogDescription className="text-white/70">
                                    {generatedPasswordContext === 'create'
                                        ? t('settings.users.generatedPasswordDescription', {
                                            username: createdUserCredentials?.username || '',
                                        })
                                        : t('settings.users.generatedPasswordDescriptionReset', {
                                            username: createdUserCredentials?.username || '',
                                        })}
                                </DialogDescription>
                            </DialogHeader>

                            <button
                                type="button"
                                onClick={() => void handleCopyGeneratedPassword()}
                                className={
                                    'group rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 w-full text-left transition-all ' +
                                    (isGeneratedPasswordCopied
                                        ? 'ring-2 ring-emerald-400/60'
                                        : 'hover:bg-emerald-400/10 focus-visible:ring-2 focus-visible:ring-emerald-400/60')
                                }
                                title={isGeneratedPasswordCopied ? t('common.copied') : t('common.copy')}
                            >
                                <p className="text-xs text-emerald-100/80">
                                    {t('settings.users.newPassword')}
                                </p>
                                <div className="mt-1 flex items-center justify-between gap-2">
                                    <p className="font-mono text-lg text-emerald-100 select-all">
                                        {createdUserCredentials?.password}
                                    </p>
                                    <span className="h-8 w-8 flex items-center justify-center text-emerald-100/70">
                                        {isGeneratedPasswordCopied ? (
                                            <Check className="h-4 w-4" />
                                        ) : (
                                            <Copy className="h-4 w-4" />
                                        )}
                                    </span>
                                </div>
                            </button>

                            <DialogFooter>
                                <Button
                                    type="button"
                                    onClick={() => {
                                        setIsCreatedUserModalOpen(false);
                                        setIsGeneratedPasswordCopied(false);
                                        setCreatedUserCredentials(null);
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    {t('common.close')}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Reset Password Dialog */}
                    <Dialog
                        open={resetPasswordTargetId !== null}
                        onOpenChange={(open) => {
                            if (!isResettingPassword && !open) {
                                setResetPasswordTargetId(null);
                                setUsersError(null);
                            }
                        }}
                    >
                        <DialogContent className="border-blue-500/30 bg-slate-950 text-white">
                            <DialogHeader>
                                <DialogTitle className="text-blue-200">
                                    {t('settings.users.resetPasswordTitle')}
                                </DialogTitle>
                                <DialogDescription className="text-white/70">
                                    {t('settings.users.resetPasswordDescription', {
                                        username:
                                            users.find((u) => u.id === resetPasswordTargetId)?.username ?? '',
                                    })}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3 py-2">
                                <p className="text-sm text-white/70">
                                    {t('settings.users.passwordGeneratedOnReset')}
                                </p>
                                {usersError && <p className="text-sm text-red-300">{usersError}</p>}
                            </div>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => {
                                        setResetPasswordTargetId(null);
                                        setUsersError(null);
                                    }}
                                    disabled={isResettingPassword}
                                    className="border border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                                >
                                    {t('common.cancel')}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => void handleResetUserPassword()}
                                    disabled={isResettingPassword}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    {isResettingPassword ? t('common.saving') : t('settings.users.resetButton')}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>


                    {/* Display : if big screen */}
                    <div className="hidden lg:block gap-6 lg:grid-cols-[280px_minmax(0,1fr)] overflow-x-auto max-w-full">
                        <UserList
                            users={users}
                            isLoading={isLoadingUsers}
                            isDeletingUser={isDeletingUser}
                            t={t}
                            onResetPassword={(userId) => {
                                setUsersError(null);
                                setResetPasswordTargetId(userId);
                            }}
                            onDeleteUser={(userId, username) => void handleDeleteUser(userId, username)}
                        />
                    </div>

                </CardContent>
            </Card>

            {/* Display : if small screen */}
            <div className="lg:hidden mt-6">
                <UserList
                    users={users}
                    isLoading={isLoadingUsers}
                    isDeletingUser={isDeletingUser}
                    t={t}
                    onResetPassword={(userId) => {
                        setUsersError(null);
                        setResetPasswordTargetId(userId);
                    }}
                    onDeleteUser={(userId, username) => void handleDeleteUser(userId, username)}
                />
            </div>
        </>
    );
}