import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './context/AuthContext';
import { SearchStateProvider } from './context/SearchStateContext';
import { LanguageProvider } from './i18n/LanguageProvider';
import { Toaster } from 'sonner';

function App() {
  return (
    <AuthProvider>
      <SearchStateProvider>
        <LanguageProvider>
          <RouterProvider router={router} />
          <Toaster position="top-right" richColors closeButton />
        </LanguageProvider>
      </SearchStateProvider>
    </AuthProvider>
  );
}

export default App;
