import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { useI18n } from '../../i18n/LanguageProvider';
import { DatabaseNamespaceEntry, getDatabaseNamespace, listDatabaseNamespaces, listUsers, updateDatabaseNamespace, User } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

type TranslateFn = ReturnType<typeof useI18n>['t'];
type TranslateKey = Parameters<TranslateFn>[0];

interface DatabaseSelectableListItem {
    key: string;
    title: string;
    subtitle?: string;
    isSelected: boolean;
    onSelect: () => void;
}

interface DatabaseSelectableListProps {
    t: TranslateFn;
    title: string;
    isLoading: boolean;
    items: DatabaseSelectableListItem[];
    emptyMessageKey?: TranslateKey;
    onReload: () => void;
}

const DatabaseSelectableList: React.FC<DatabaseSelectableListProps> = ({
    t,
    title,
    isLoading,
    items,
    emptyMessageKey = 'settings.database.empty',
    onReload,
}) => (
    <div className="w-full space-y-3 rounded-lg border border-white/10 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium text-white">{title}</h3>
            <Button
                type="button"
                variant="outline"
                onClick={onReload}
                className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
                {t('settings.database.refreshList')}
            </Button>
        </div>

        {isLoading ? (
            <p className="text-sm text-white/60">{t('common.loading')}</p>
        ) : items.length === 0 ? (
            <p className="text-sm text-white/60">{t(emptyMessageKey)}</p>
        ) : (
            <div className="space-y-2">
                {items.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        onClick={item.onSelect}
                        className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${item.isSelected
                            ? 'border-teal-400/40 bg-teal-500/15 text-teal-100'
                            : 'border-white/10 bg-slate-950/50 text-white/80 hover:bg-white/5'
                            }`}
                    >
                        <p className="font-mono text-sm">{item.title}</p>
                        {item.subtitle ? <p className="mt-1 text-xs text-white/50">{item.subtitle}</p> : null}
                    </button>
                ))}
            </div>
        )}
    </div>
);

interface DatabaseNamespaceListProps {
    t: TranslateFn;
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
    <DatabaseSelectableList
        t={t}
        title={t('settings.database.namespaces')}
        isLoading={isLoading}
        items={namespaces.map((entry) => ({
            key: entry.namespace,
            title: entry.namespace,
            subtitle: t('settings.database.updatedAt', { value: entry.updatedAt || '-' }),
            isSelected: selectedNamespace === entry.namespace,
            onSelect: () => onSelect(entry.namespace),
        }))}
        onReload={onReload}
    />
);

export interface DatabaseRawEditorPanelProps {
    t: TranslateFn;
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
    t: TranslateFn;
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
    <DatabaseSelectableList
        t={t}
        title={t('settings.users.managingUsers')}
        isLoading={isLoading}
        items={users.map((entry) => ({
            key: String(entry.id),
            title: entry.username,
            isSelected: selectedUser?.id === entry.id,
            onSelect: () => onSelect(entry),
        }))}
        onReload={onReload}
    />
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
    const isAdmin = isAuthenticated && user?.username === 'admin';

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

    const clearDatabaseFeedback = useCallback(() => {
        setDatabaseError(null);
        setDatabaseMessage(null);
    }, []);

    const fetchAndSetDatabaseNamespaces = useCallback(async () => {
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
    }, [t]);

    const fetchAndSetDatabaseUsers = useCallback(async () => {
        setIsLoadingDatabaseUsers(true);
        try {
            const fetchedUsers = await listUsers(true);
            setUsers(fetchedUsers);
            setSelectedUser((current) => {
                if (current && fetchedUsers.some((entry) => entry.id === current.id)) {
                    return current;
                }
                return fetchedUsers[0] || null;
            });
        } catch (err) {
            setDatabaseError(err instanceof Error ? err.message : t('settings.database.loadFailed'));
        } finally {
            setIsLoadingDatabaseUsers(false);
        }
    }, [t]);

    const handleDatabaseReload = useCallback(async () => {
        if (!selectedDatabaseNamespace || !selectedUser) {
            return;
        }

        clearDatabaseFeedback();
        setIsLoadingDatabaseValue(true);
        try {
            const entry = await getDatabaseNamespace(selectedUser.id, selectedDatabaseNamespace);
            setDatabaseRawValue(JSON.stringify(entry || '', null, 2));
            setDatabaseMessage(t('settings.database.reloaded'));
        } catch (reloadError) {
            setDatabaseError(
                reloadError instanceof Error ? reloadError.message : t('settings.database.entryLoadFailed'),
            );
        } finally {
            setIsLoadingDatabaseValue(false);
        }
    }, [clearDatabaseFeedback, selectedDatabaseNamespace, selectedUser, t]);

    const handleDatabaseNamespacesReload = useCallback(async () => {
        clearDatabaseFeedback();
        await fetchAndSetDatabaseNamespaces();
        setDatabaseMessage(t('settings.database.listReloaded'));
    }, [clearDatabaseFeedback, fetchAndSetDatabaseNamespaces, t]);

    const handleDatabaseUsersReload = useCallback(async () => {
        clearDatabaseFeedback();
        await fetchAndSetDatabaseUsers();
        setDatabaseMessage(t('settings.database.listReloaded'));
    }, [clearDatabaseFeedback, fetchAndSetDatabaseUsers, t]);

    const handleDatabasePrettyFormat = useCallback(() => {
        setDatabaseError(null);
        try {
            const prettyValue = JSON.stringify(JSON.parse(databaseRawValue), null, 2);
            setDatabaseRawValue(prettyValue);
        } catch {
            setDatabaseError(t('settings.database.invalidJson'));
        }
    }, [databaseRawValue, t]);

    const handleDatabaseSave = useCallback(async () => {
        if (!selectedDatabaseNamespace || !selectedUser) {
            return;
        }

        clearDatabaseFeedback();
        setIsSavingDatabaseValue(true);
        try {
            await updateDatabaseNamespace(
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
    }, [clearDatabaseFeedback, databaseRawValue, selectedDatabaseNamespace, selectedUser, t]);

    useEffect(() => {
        if (!isAdmin) {
            return;
        }

        void fetchAndSetDatabaseNamespaces();
        void fetchAndSetDatabaseUsers();
    }, [fetchAndSetDatabaseNamespaces, fetchAndSetDatabaseUsers, isAdmin]);

    useEffect(() => {
        if (!isAdmin || !selectedDatabaseNamespace || !selectedUser) {
            return;
        }

        void handleDatabaseReload();
    }, [handleDatabaseReload, isAdmin, selectedDatabaseNamespace, selectedUser]);

    return (
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

                <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,280px)_minmax(0,1fr)]">
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
    );
}