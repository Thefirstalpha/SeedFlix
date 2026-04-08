import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { Home } from "./components/Home";
import { MovieDetails } from "./components/MovieDetails";
import { SeriesDetails } from "./components/SeriesDetails";
import { WishList } from "./components/WishList";
import { NotFound } from "./components/NotFound";
import { Login } from "./components/Login";
import { Settings } from "./components/Settings";
import { Downloads } from "./components/Downloads";
import { InitialSetup } from "./components/InitialSetup";
import { RequireAuth } from "./components/RequireAuth";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { path: "login", Component: Login },
      {
        Component: RequireAuth,
        children: [
          { index: true, Component: Home },
          { path: "movie/:id", Component: MovieDetails },
          { path: "series/:id", Component: SeriesDetails },
          { path: "wishlist", Component: WishList },
          { path: "downloads", Component: Downloads },
          { path: "setup", Component: InitialSetup },
          { path: "settings", Component: Settings },
        ],
      },
      { path: "*", Component: NotFound },
    ],
  },
]);