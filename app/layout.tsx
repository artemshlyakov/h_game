import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Тыквенный переполох — хэллоуинский турнир",
  description: "Лови тыквы, уворачивайся от привидений и побеждай коллег в хэллоуинской аркаде.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
