import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';


import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAuth } from '../../context/AuthContext';
import { useI18n, type SupportedLanguage } from '../../i18n/LanguageProvider';
import {
    changePassword,
} from '../../services/authService';

export function SettingPassword({ setup, onComplete }: { setup: boolean; onComplete?: (() => void) | undefined }) {

    const { isAuthenticated, isLoading, user, refresh } =
        useAuth();
    const { t, availableLanguages, setLanguage } = useI18n();
    const [isSaving, setIsSaving] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);



    const handlePasswordUpdate = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);
        setMessage(null);
        setIsSaving(true);


        if (!newPassword) {
            setError(t('setup.password.errors.required'));
            return setIsSaving(false);
        }

        if (newPassword !== confirmPassword) {
            setError(t('setup.password.errors.mismatch'));
            return setIsSaving(false);
        }
        try {
            await changePassword(newPassword);
            await refresh();
            setNewPassword('');
            setConfirmPassword('');
            setMessage(t('settings.messages.passwordUpdated'));
            onComplete?.();
        } catch (submitError) {
            setError(
                submitError instanceof Error ? submitError.message : t('settings.messages.updateFailed'),
            );
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="border-emerald-500/30 bg-emerald-950/15 text-white grid gap-4">
            <CardHeader>
                <CardTitle className="text-emerald-200">{t('settings.security.title')}</CardTitle>
            </CardHeader>
            <CardContent>
                {user?.flags?.mustUpdatePassword || setup ? (
                    <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 mt-0">

                        {setup ? (
                            <>
                                {user?.username === 'admin'
                                    ? t('setup.password.description')
                                    : t('setup.password.cardDescriptionUser')}
                            </>
                        ) : (
                            <>{t('settings.security.changePasswordSuggestion')}</>
                        )}
                    </div>
                ) : null}
                <form onSubmit={handlePasswordUpdate} className="space-y-4">
                    <div className="space-y-2 md:max-w-md">
                        <Label htmlFor="setup-new-password">{t('setup.password.newPassword')}</Label>
                        <Input
                            id="setup-new-password"
                            type="password"
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            className="border-white/10 bg-slate-900 text-white"
                        />
                    </div>
                    <div className="space-y-2 md:max-w-md">
                        <Label htmlFor="setup-confirm-password">{t('setup.password.confirm')}</Label>
                        <Input
                            id="setup-confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            className="border-white/10 bg-slate-900 text-white"
                        />
                    </div>
                    {message && <p className="text-sm text-emerald-300">{message}</p>}
                    {error && <p className="text-sm text-red-300">{error}</p>}
                    {setup ? (
                        <div className="flex items-center justify-end gap-3">
                            <Button
                                type="submit"
                                disabled={isSaving}
                                className="bg-cyan-600 text-white hover:bg-cyan-700"
                            >
                                {isSaving ? t('common.saving') : t('setup.password.saveAndContinue')}
                            </Button>
                        </div>
                    ) : (
                        <Button
                            type="submit"
                            disabled={isSaving}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {isSaving ? t('common.saving') : t('settings.security.update')}
                        </Button>
                    )}
                </form>
            </CardContent>
        </Card>
    );
}