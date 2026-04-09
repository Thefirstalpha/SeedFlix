import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './i18n/LanguageProvider';
import { Toaster } from 'sonner';

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors closeButton />
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
