import React from 'react';
import { Button } from '../ui/button';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '../ui/alert-dialog';
import { RectangleEllipsis, Trash2 } from 'lucide-react';

interface User {
  id: number;
  username: string;
}

interface UserListProps {
  users: User[];
  isLoading: boolean;
  isDeletingUser: number | null;
  t: (key: string, params?: Record<string, any>) => string;
  onResetPassword: (userId: number) => void;
  onDeleteUser: (userId: number, username: string) => void;
}

export const UserList: React.FC<UserListProps> = ({
  users,
  isLoading,
  isDeletingUser,
  t,
  onResetPassword,
  onDeleteUser,
}) => {
  return (
    <div className="w-full space-y-4 p-4 bg-slate-800/50 rounded-md border border-orange-500/20">
      <h3 className="font-medium text-white">{t('settings.users.managingUsers')}</h3>

      {isLoading ? (
        <p className="text-sm text-white/60">{t('common.loading')}</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-white/60">{t('settings.users.noUsers')}</p>
      ) : (
        <div className="space-y-2">
          {users.map((listUser) => (
            <div
              key={listUser.id}
              className="flex items-center justify-between rounded border border-white/10 bg-slate-900/50 px-4 py-3"
            >
              <p className="font-medium text-white">{listUser.username}</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onResetPassword(listUser.id)}
                  disabled={isDeletingUser === listUser.id}
                  className="text-blue-300 hover:text-blue-200 hover:bg-blue-500/15"
                >
                  <RectangleEllipsis className="mr-2 sm:hidden" />
                  <span className='hidden sm:block'>{t('settings.users.resetButton')}</span>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isDeletingUser === listUser.id}
                      className="text-red-300 hover:text-red-200 hover:bg-red-500/15"
                    >
                      <Trash2 className="mr-2 sm:hidden" />
                      <span className='hidden sm:block'>{t('common.delete')}</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-red-500/30 bg-slate-950 text-white">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-red-200">
                        {t('settings.users.confirmDeleteTitle')}
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-white/70">
                        {t('settings.users.confirmDeleteDescription', {
                          username: listUser.username,
                        })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white">
                        {t('common.cancel')}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDeleteUser(listUser.id, listUser.username)}
                        className="bg-red-600 text-white hover:bg-red-700"
                      >
                        {t('common.delete')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};