import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { Home } from "./components/Home";
import { MovieDetails } from "./components/MovieDetails";
import { SeriesDetails } from "./components/SeriesDetails";
import { WishList } from "./components/WishList";
import { NotFound } from "./components/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "movie/:id", Component: MovieDetails },
      { path: "series/:id", Component: SeriesDetails },
      { path: "wishlist", Component: WishList },
      { path: "*", Component: NotFound },
    ],
  },
]);