import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { SearchStateProvider } from './context/SearchStateContext';
import { LanguageProvider } from './i18n/LanguageProvider';
import { router } from './routes';

function App() {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <SearchStateProvider>
          <LanguageProvider>
            <RouterProvider router={router} />
            <Toaster position="top-right" richColors closeButton />
          </LanguageProvider>
        </SearchStateProvider>
      </RealtimeProvider>
    </AuthProvider>
  );
}

export default App;

