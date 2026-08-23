import { createBrowserRouter } from 'react-router';
import { Downloads } from './pages/Downloads';
import { FtpExplorer } from './pages/FtpExplorer';
import { Home } from './pages/Home';
import { InitialSetup } from './pages/InitialSetup';
import { Login } from './pages/Login';
import { MovieDetails } from './pages/MovieDetails';
import { NotFound } from './pages/NotFound';
import Notifications from './pages/Notifications';
import { RequireAuth } from './components/RequireAuth';
import { Root } from './components/Root';
import { SeriesDetails } from './pages/SeriesDetails';
import { Settings } from './pages/Settings';
import { WishList } from './pages/WishList';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      { path: 'login', Component: Login },
      {
        Component: RequireAuth,
        children: [
          { index: true, Component: Home },
          { path: 'movie/:id', Component: MovieDetails },
          { path: 'series/:id', Component: SeriesDetails },
          { path: 'wishlist', Component: WishList },
          { path: 'downloads', Component: Downloads },
          { path: 'files', Component: FtpExplorer },
          { path: 'notifications', Component: Notifications },
          { path: 'setup', Component: InitialSetup },
          { path: 'settings', Component: Settings },
        ],
      },
      { path: '*', Component: NotFound },
    ],
  },
]);
