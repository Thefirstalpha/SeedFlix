import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { useI18n } from '../../i18n/LanguageProvider';
import { DatabaseNamespaceEntry, getDatabaseNamespace, listDatabaseNamespaces, listUsers, updateDatabaseNamespace, User } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

interface DatabaseNamespaceListProps {
    t: (key: string, options?: any) => string;
    isLoading: boolean;
    namespaces: Array<{ namespace: string; updatedAt?: string }>;
    selectedNamespace: string | null;
    onReload: () => void;
    onSelect: (namespace: string) => void;
}

export const DatabaseNamespaceList: React.FC<DatabaseNamespaceListProps> = ({
    t,
    isLoading,
    namespaces,
    selectedNamespace,
    onReload,
    onSelect,
}) => (
    <div className="w-full space-y-3 rounded-lg border border-white/10 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium text-white">{t('settings.database.namespaces')}</h3>
            <Button
                type="button"
                variant="outline"
                onClick={() => onReload()}
                className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
                {t('settings.database.refreshList')}
            </Button>
        </div>

        {isLoading ? (
            <p className="text-sm text-white/60">{t('common.loading')}</p>
        ) : namespaces.length === 0 ? (
            <p className="text-sm text-white/60">{t('settings.database.empty')}</p>
        ) : (
            <div className="space-y-2">
                {namespaces.map((entry) => (
                    <button
                        key={entry.namespace}
                        type="button"
                        onClick={() => onSelect(entry.namespace)}
                        className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${selectedNamespace === entry.namespace
                            ? 'border-teal-400/40 bg-teal-500/15 text-teal-100'
                            : 'border-white/10 bg-slate-950/50 text-white/80 hover:bg-white/5'
                            }`}
                    >
                        <p className="font-mono text-sm">{entry.namespace}</p>
                        <p className="mt-1 text-xs text-white/50">
                            {t('settings.database.updatedAt', { value: entry.updatedAt || '-' })}
                        </p>
                    </button>
                ))}
            </div>
        )}
    </div>
);

export interface DatabaseRawEditorPanelProps {
    t: (key: string, options?: any) => string;
    selectedNamespace: string | null;
    isLoadingValue: boolean;
    isSavingValue: boolean;
    rawValue: string;
    onRawValueChange: (value: string) => void;
    onReload: () => void;
    onPrettyFormat: () => void;
    onSave: () => void;
    message?: string | null;
    error?: string | null;
}

interface DatabaseUsersListProps {
    t: (key: string, options?: any) => string;
    isLoading: boolean;
    users: User[];
    selectedUser: User | null;
    onReload: () => void;
    onSelect: (user: User) => void;
}

export const DatabaseUserList: React.FC<DatabaseUsersListProps> = ({
    t,
    isLoading,
    users,
    selectedUser,
    onReload,
    onSelect,
}) => (
    <div className="w-full space-y-3 rounded-lg border border-white/10 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium text-white">{t('settings.database.namespaces')}</h3>
            <Button
                type="button"
                variant="outline"
                onClick={() => onReload()}
                className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
                {t('settings.database.refreshList')}
            </Button>
        </div>

        {isLoading ? (
            <p className="text-sm text-white/60">{t('common.loading')}</p>
        ) : users.length === 0 ? (
            <p className="text-sm text-white/60">{t('settings.database.empty')}</p>
        ) : (
            <div className="space-y-2">
                {users.map((entry) => (
                    <button
                        key={entry.id}
                        type="button"
                        onClick={() => onSelect(entry)}
                        className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${selectedUser?.id === entry.id
                            ? 'border-teal-400/40 bg-teal-500/15 text-teal-100'
                            : 'border-white/10 bg-slate-950/50 text-white/80 hover:bg-white/5'
                            }`}
                    >
                        <p className="font-mono text-sm">{entry.username}</p>
                    </button>
                ))}
            </div>
        )}
    </div>
);


export const DatabaseRawEditorPanel: React.FC<DatabaseRawEditorPanelProps> = ({
    t,
    selectedNamespace,
    isLoadingValue,
    isSavingValue,
    rawValue,
    onRawValueChange,
    onReload,
    onPrettyFormat,
    onSave,
    message,
    error,
}) => (
    <div className="w-full space-y-4 rounded-lg border border-white/10 bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
                <h3 className="font-medium text-white">
                    {selectedNamespace || t('settings.database.noSelection')}
                </h3>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={(__e) => void onReload()}
                    disabled={!selectedNamespace || isLoadingValue || isSavingValue}
                    className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                    {t('settings.database.reload')}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={(__e) => onPrettyFormat()}
                    disabled={!selectedNamespace || isLoadingValue || isSavingValue}
                    className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                    {t('settings.database.prettyFormat')}
                </Button>
                <Button
                    type="button"
                    onClick={(__e) => void onSave()}
                    disabled={!selectedNamespace || isLoadingValue || isSavingValue}
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                    {isSavingValue ? t('common.saving') : t('common.save')}
                </Button>
            </div>
        </div>

        <div className="space-y-2">
            <Label htmlFor="database-raw-value">{t('settings.database.rawEditor')}</Label>
            <Textarea
                id="database-raw-value"
                value={rawValue}
                onChange={(__event) => onRawValueChange(__event.currentTarget.value)}
                disabled={!selectedNamespace || isLoadingValue}
                className="min-h-[420px] bg-slate-950 border-white/10 font-mono text-sm text-white"
                spellCheck={false}
            />
        </div>

        {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
);




export function SettingDatabase() {
    const { t } = useI18n();
    const { isAuthenticated, user } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [databaseNamespaces, setDatabaseNamespaces] = useState<DatabaseNamespaceEntry[]>([]);
    const [selectedDatabaseNamespace, setSelectedDatabaseNamespace] = useState('');
    const [databaseRawValue, setDatabaseRawValue] = useState('');
    const [databaseMessage, setDatabaseMessage] = useState<string | null>(null);
    const [databaseError, setDatabaseError] = useState<string | null>(null);
    const [isLoadingDatabaseNamespaces, setIsLoadingDatabaseNamespaces] = useState(false);
    const [isLoadingDatabaseUsers, setIsLoadingDatabaseUsers] = useState(false);
    const [isLoadingDatabaseValue, setIsLoadingDatabaseValue] = useState(false);
    const [isSavingDatabaseValue, setIsSavingDatabaseValue] = useState(false);


    // Extraction de la logique commune de chargement des namespaces
    const fetchAndSetDatabaseNamespaces = async () => {
        setIsLoadingDatabaseNamespaces(true);
        try {
            const response = await listDatabaseNamespaces();
            const namespaces = Array.isArray(response.namespaces) ? response.namespaces : [];
            setDatabaseNamespaces(namespaces);
            if (namespaces.length === 0) {
                setDatabaseRawValue('');
            }
            setSelectedDatabaseNamespace((current) => {
                if (current && namespaces.some((entry) => entry.namespace === current)) {
                    return current;
                }
                return namespaces[0]?.namespace || '';
            });
        } catch (err) {
            setDatabaseError(err instanceof Error ? err.message : t('settings.database.loadFailed'));
        } finally {
            setIsLoadingDatabaseNamespaces(false);
        }
    };

    // Extraction de la logique commune de chargement des namespaces
    const fetchAndSetDatabaseUsers = async () => {
        setIsLoadingDatabaseUsers(true);
        try {
            const users = await listUsers(true);
            setUsers(users);
            setSelectedUser((current) => {
                if (current && users.some((user) => user.username === current.username)) {
                    return current;
                }
                return users[0] || null;
            });
        } catch (err) {
            setDatabaseError(err instanceof Error ? err.message : t('settings.database.loadFailed'));
        } finally {
            setIsLoadingDatabaseUsers(false);
        }
    };

    useEffect(() => {
        if (!isAuthenticated || user?.username !== 'admin') {
            return;
        }
        void fetchAndSetDatabaseNamespaces();
        void fetchAndSetDatabaseUsers();
    }, [isAuthenticated, t, user?.username]);

    useEffect(() => {
        if (!isAuthenticated || user?.username !== 'admin' || !selectedDatabaseNamespace) {
            return;
        }

        handleDatabaseReload();
    }, [isAuthenticated, selectedDatabaseNamespace, t, user?.username]);


    const handleDatabaseReload = async () => {
        if (!selectedDatabaseNamespace || !selectedUser) {
            return;
        }

        setDatabaseError(null);
        setDatabaseMessage(null);
        setIsLoadingDatabaseValue(true);
        try {
            const entry = await getDatabaseNamespace(selectedUser.id, selectedDatabaseNamespace, );
            setDatabaseRawValue(JSON.stringify(entry || '', null, 2));
            setDatabaseMessage(t('settings.database.reloaded'));
        } catch (reloadError) {
            setDatabaseError(
                reloadError instanceof Error ? reloadError.message : t('settings.database.entryLoadFailed'),
            );
        } finally {
            setIsLoadingDatabaseValue(false);
        }
    };

    const handleDatabaseNamespacesReload = async () => {
        setDatabaseError(null);
        setDatabaseMessage(null);
        await fetchAndSetDatabaseNamespaces();
        setDatabaseMessage(t('settings.database.listReloaded'));
    };
    const handleDatabaseUsersReload = async () => {
        setDatabaseError(null);
        setDatabaseMessage(null);
        await fetchAndSetDatabaseUsers();
        setDatabaseMessage(t('settings.database.listReloaded'));
    };

    const handleDatabasePrettyFormat = () => {
        setDatabaseError(null);
        try {
            const prettyValue = JSON.stringify(JSON.parse(databaseRawValue), null, 2);
            setDatabaseRawValue(prettyValue);
        } catch {
            setDatabaseError(t('settings.database.invalidJson'));
        }
    };

    const handleDatabaseSave = async () => {
        if (!selectedDatabaseNamespace || !selectedUser) {
            return;
        }

        setDatabaseError(null);
        setDatabaseMessage(null);
        setIsSavingDatabaseValue(true);
        try {
            const updatedEntry = await updateDatabaseNamespace(
                selectedUser.id,
                selectedDatabaseNamespace,
                databaseRawValue,
            );
            
            setDatabaseMessage(t('settings.database.saved'));
        } catch (saveError) {
            setDatabaseError(
                saveError instanceof Error ? saveError.message : t('settings.database.saveFailed'),
            );
        } finally {
            setIsSavingDatabaseValue(false);
        }
    };

    return (
        <>
            <Card className="border-teal-500/30 bg-teal-950/15 text-white">
                <CardHeader>
                    <CardTitle className="text-teal-200">{t('settings.database.title')}</CardTitle>
                    <CardDescription className="text-teal-100/70">
                        {t('settings.database.description')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                        {t('settings.database.warning')}
                    </div>
                    <div className="hidden lg:block overflow-x-auto max-w-full">
                        <DatabaseNamespaceList
                            t={t}
                            isLoading={isLoadingDatabaseNamespaces}
                            namespaces={databaseNamespaces}
                            selectedNamespace={selectedDatabaseNamespace}
                            onReload={handleDatabaseNamespacesReload}
                            onSelect={setSelectedDatabaseNamespace}
                        />
                        <DatabaseUserList
                            t={t}
                            isLoading={isLoadingDatabaseUsers}
                            users={users}
                            selectedUser={selectedUser}
                            onReload={handleDatabaseUsersReload}
                            onSelect={setSelectedUser}
                        />

                        <DatabaseRawEditorPanel
                            t={t}
                            selectedNamespace={selectedDatabaseNamespace}
                            isLoadingValue={isLoadingDatabaseValue}
                            isSavingValue={isSavingDatabaseValue}
                            rawValue={databaseRawValue}
                            onRawValueChange={setDatabaseRawValue}
                            onReload={handleDatabaseReload}
                            onPrettyFormat={handleDatabasePrettyFormat}
                            onSave={handleDatabaseSave}
                            message={databaseMessage}
                            error={databaseError}
                        />
                    </div>
                </CardContent>
            </Card>
            {/* Mobile/tablette : composants hors Card */}
            <div className="flex flex-col gap-6 lg:hidden mt-6">
                <DatabaseNamespaceList
                    t={t}
                    isLoading={isLoadingDatabaseNamespaces}
                    namespaces={databaseNamespaces}
                    selectedNamespace={selectedDatabaseNamespace}
                    onReload={handleDatabaseNamespacesReload}
                    onSelect={setSelectedDatabaseNamespace}
                />
                <DatabaseUserList
                    t={t}
                    isLoading={isLoadingDatabaseUsers}
                    users={users}
                    selectedUser={selectedUser}
                    onReload={handleDatabaseUsersReload}
                    onSelect={setSelectedUser}
                />
                <DatabaseRawEditorPanel
                    t={t}
                    selectedNamespace={selectedDatabaseNamespace}
                    isLoadingValue={isLoadingDatabaseValue}
                    isSavingValue={isSavingDatabaseValue}
                    rawValue={databaseRawValue}
                    onRawValueChange={setDatabaseRawValue}
                    onReload={handleDatabaseReload}
                    onPrettyFormat={handleDatabasePrettyFormat}
                    onSave={handleDatabaseSave}
                    message={databaseMessage}
                    error={databaseError}
                />
            </div>
        </>
    )
}