import { createBrowserRouter } from 'react-router';
import { Downloads } from './components/Downloads';
import { Home } from './components/Home';
import { InitialSetup } from './components/InitialSetup';
import { Login } from './components/Login';
import { MovieDetails } from './components/MovieDetails';
import { NotFound } from './components/NotFound';
import Notifications from './components/Notifications';
import { RequireAuth } from './components/RequireAuth';
import { Root } from './components/Root';
import { SeriesDetails } from './components/SeriesDetails';
import { Settings } from './components/Settings';
import { WishList } from './components/WishList';

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
          { path: 'notifications', Component: Notifications },
          { path: 'setup', Component: InitialSetup },
          { path: 'settings', Component: Settings },
        ],
      },
      { path: '*', Component: NotFound },
    ],
  },
]);
