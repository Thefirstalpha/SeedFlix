import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { SearchStateProvider } from './context/SearchStateContext';
import { LanguageProvider } from './i18n/LanguageProvider';
import { router } from './routes';

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
