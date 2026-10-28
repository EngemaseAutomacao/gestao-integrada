import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export interface MenuCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  to: string;
  badgeCount?: number;
}

/**
 * Cartão de menu reutilizado em FerramentasMenu e VeiculosMenu.
 * Mantém visual idêntico ao implementado anteriormente em cada página.
 */
export function MenuCard({ title, description, icon, to, badgeCount }: MenuCardProps) {
  return (
    <Link to={to} className="block h-full">
      <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer hover:border-primary h-full flex flex-col">
        {badgeCount && badgeCount > 0 ? (
          <div className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center z-10">
            {badgeCount}
          </div>
        ) : null}
        <CardHeader className="text-center pb-2 flex-1 flex flex-col items-center justify-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            {icon}
          </div>
          <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
          <CardDescription className="text-xs sm:text-sm">{description}</CardDescription>
        </CardHeader>
        <CardContent className="text-center pt-0">
          <span className="text-sm font-medium text-primary">Acessar →</span>
        </CardContent>
      </Card>
    </Link>
  );
}
