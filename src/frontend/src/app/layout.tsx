import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MQTTProvider } from "@/contexts/MQTTContext";
import { AlertProvider } from "@/contexts/AlertContext";
import { DeviceManagerProvider } from "@/contexts/DeviceManagerContext";
import { ApplicationProvider } from "@/contexts/ApplicationContext";
import { Toaster } from "sonner";
import Topbar from "@/components/template/Topbar";
import Sidebar from "@/components/template/Sidebar";
import { UserProvider } from "@/contexts/UserContext";
import { ProjectsProvider } from "@/contexts/ProjectsContext";
import { SessionProvider } from "@/contexts/SessionContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MAGM",
  description: "Microalgae Growth Monitoring System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UserProvider>
          <ProjectsProvider>
            <AlertProvider>
              <MQTTProvider>
                <DeviceManagerProvider>
                  <SessionProvider>
                    <ApplicationProvider>
                      <section className="flex w-screen">
                        <Sidebar />
                        <main className="w-full h-screen overflow-y-auto p-4">
                          <Topbar />
                          {children}
                        </main>
                      </section>
                      <Toaster position="bottom-center" richColors />
                    </ApplicationProvider>
                  </SessionProvider>
                </DeviceManagerProvider>
              </MQTTProvider>
            </AlertProvider>
          </ProjectsProvider>
        </UserProvider>
      </body>
    </html>
  );
}
