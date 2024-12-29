"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  PlayIcon,
  PauseIcon,
  LogInIcon,
  LogOutIcon,
  AlertTriangleIcon,
  Coffee,
} from "lucide-react";

export default function App() {
  const version = "1.0.2";
  const [versionOk, setVersionOk] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    chrome.storage.local.get(["email", "password", "running"], (result) => {
      if (result.email && result.password) {
        setEmail(result.email);
        setPassword(result.password);
        setIsLoggedIn(true);
      }
      if (result.running) {
        setIsBotRunning(result.running);
      }
    });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const url = "https://www.chessmaster.cloud/api/version";
      const requestData = { version: version };
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestData),
        });
        const data = await response.json();
        setVersionOk(data.status === 200);
      } catch (error) {
        setVersionOk(false);
        console.error("Error:", error);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      chrome.runtime.sendMessage({
        action: isBotRunning ? "start" : "stop",
      });
      chrome.storage.local.set({ running: isBotRunning });
    }
  }, [isBotRunning, isLoggedIn]);

  const handleRegisterClick = (
    e: React.MouseEvent<HTMLAnchorElement, MouseEvent>
  ) => {
    e.preventDefault();
    chrome.tabs.create({ url: "https://www.chessmaster.cloud/register" });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    chrome.runtime.sendMessage(
      { action: "login", email: email, password: password },
      async function (response) {
        if (response.success) {
          setIsLoggedIn(true);
          await chrome.storage.local.set({ email, password });
        }
      }
    );
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    chrome.storage.local.remove(["email", "password", "running"]);
    setIsBotRunning(false);
    setEmail("");
    setPassword("");
  };

  return (
    <div className="w-80 p-4 bg-[#2f3437] text-white min-h-[400px]">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <ChessIcon className="w-6 h-6 text-[#7fa650]" />
          <div>
            <h1 className="text-xl font-bold">Chess Master Bot</h1>
            <p className="text-xs text-gray-400">v{version}</p>
          </div>
        </div>
        {isLoggedIn && (
          <LogOutIcon
            className="text-red-700 cursor-pointer"
            onClick={handleLogout}
          />
        )}
      </header>

      <main>
        {!versionOk ? (
          <Card className="bg-[#1a1a1a] border-red-700">
            <CardHeader>
              <CardTitle className="text-red-400 flex items-center">
                <AlertTriangleIcon className="w-5 h-5 mr-2" />
                Outdated Version
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300 mb-4">
                Your Chess Master Bot is outdated. Please update to continue
                using the extension.
              </p>
              <Button
                onClick={() =>
                  window.open(
                    "https://www.chessmaster.cloud/#download",
                    "_blank"
                  )
                }
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                Update Now
              </Button>
            </CardContent>
          </Card>
        ) : !isLoggedIn ? (
          <Card className="bg-[#1a1a1a] border-[#424242]">
            <CardHeader>
              <CardTitle className="text-[#7fa650]">Welcome Back</CardTitle>
              <CardDescription className="text-gray-400">
                Login to access Chess Master Bot
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    id="email"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-[#2f3437] border-[#424242] text-white placeholder-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    id="password"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-[#2f3437] border-[#424242] text-white placeholder-gray-400"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[#7fa650] hover:bg-[#6c8c44] text-white"
                >
                  <LogInIcon className="w-4 h-4 mr-2" />
                  Log In
                </Button>
              </form>
              <div className="mt-4 text-center">
                <span className="text-sm text-gray-400">
                  Don't have an account?
                </span>
                <a
                  href="#"
                  onClick={handleRegisterClick}
                  className="text-sm text-[#7fa650] hover:text-[#6c8c44] ml-1"
                >
                  Register here
                </a>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="control" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-[#1a1a1a]">
              <TabsTrigger
                value="control"
                className="data-[state=active]:bg-[#2f3437]"
              >
                Control
              </TabsTrigger>
              <TabsTrigger
                value="status"
                className="data-[state=active]:bg-[#2f3437]"
              >
                Status
              </TabsTrigger>
            </TabsList>
            <TabsContent value="control" className="mt-4">
              <Card className="bg-[#1a1a1a] border-[#424242]">
                <CardHeader>
                  <CardTitle className="text-[#7fa650]">Bot Control</CardTitle>
                  <CardDescription className="text-gray-400">
                    Manage your Chess Master Bot
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => setIsBotRunning((prev) => !prev)}
                    className={`w-full ${
                      isBotRunning
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-[#7fa650] hover:bg-[#6c8c44]"
                    } text-white`}
                  >
                    {isBotRunning ? (
                      <>
                        <PauseIcon className="w-4 h-4 mr-2" />
                        Stop Bot
                      </>
                    ) : (
                      <>
                        <PlayIcon className="w-4 h-4 mr-2" />
                        Start Bot
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="status" className="mt-4">
              <Card className="bg-[#1a1a1a] border-[#424242]">
                <CardHeader>
                  <CardTitle className="text-[#7fa650]">Bot Status</CardTitle>
                  <CardDescription className="text-gray-400">
                    Current activity of your bot
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-300">
                      Status:
                    </span>
                    <Badge
                      variant={isBotRunning ? "default" : "secondary"}
                      className="bg-[#7fa650] text-white"
                    >
                      {isBotRunning ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="mt-4 text-sm text-gray-400">
                    {isBotRunning
                      ? "Bot is analyzing the current position..."
                      : "Bot is inactive. Press Start to begin analysis."}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>

      <footer className="mt-4 text-center">
        <Button
          variant="outline"
          size="sm"
          className="w-full bg-[#13C3FF] text-white hover:bg-[#11A8E3] py-4 text-ms"
          onClick={() => window.open("https://ko-fi.com/nazmox", "_blank")}
        >
          <Coffee className="w-4 h-4 mr-2" />
          Support us on Ko-fi
        </Button>
        <p className="mt-2 text-xs text-gray-500">ChessMaster v{version}</p>
      </footer>
    </div>
  );
}

function ChessIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 16l-1.447.724a1 1 0 0 0-.553.894V20h12v-2.382a1 1 0 0 0-.553-.894L16 16H8z" />
      <path d="M8.5 16v-2.5h7V16" />
      <path d="M12 4v2.5" />
      <path d="M10.5 7.5h3" />
      <path d="M8 9l1 3h6l1-3" />
    </svg>
  );
}
