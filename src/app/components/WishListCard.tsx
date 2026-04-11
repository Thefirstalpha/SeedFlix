import { ReactNode } from "react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Star, Calendar, Tv } from "lucide-react";

interface WishListCardProps {
  poster: string;
  title: string;
  year: number;
  rating: number;
  genre: string;
  type: "movie" | "series";
  children?: ReactNode; // Pour injecter saisons, épisodes, tracker, etc.
}

export function WishListCard({ poster, title, year, rating, genre, type, children }: WishListCardProps) {
  return (
    <Card className="border-white/10 bg-white/5 transition-all">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-4">
          <img
            src={poster}
            alt={title}
            className="w-16 rounded object-cover aspect-[2/3]"
          />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-lg hover:text-cyan-300 transition-colors">
              {title}
            </p>
            <div className="flex items-center gap-3 text-white/60 text-sm mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {year}
              </span>
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                <span className="font-semibold text-white">{rating}</span>
              </span>
            </div>
            <div className="mt-2">
              <Badge className={type === "series" ? "bg-cyan-600/20 text-cyan-200 border-cyan-500/30" : "bg-purple-600/20 text-purple-300 border-purple-500/30"}>
                {type === "series" ? <Tv className="w-3 h-3 mr-1" /> : null}
                {genre}
              </Badge>
            </div>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
