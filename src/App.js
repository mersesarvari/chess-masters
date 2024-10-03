import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { PlayIcon, CirclePause, Settings } from "lucide-react";
export default function App() {
    const [isBotRunning, setIsBotRunning] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [depth, setDepth] = useState(10);
    const [autoPlay, setAutoPlay] = useState(false);
    const toggleBot = () => {
        setIsBotRunning(!isBotRunning);
        // Here you would add the logic to actually start or stop the bot
    };
    return (_jsx("body", { className: "bg-[#2f3437]", children: _jsxs("div", { className: "w-80 p-4 bg-[#2f3437] text-white", children: [_jsxs("header", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { className: "flex items-center", children: [_jsx(ChessIcon, { className: "w-6 h-6 mr-2 text-[#7fa650]" }), _jsx("h1", { className: "text-xl font-bold", children: "Chess Analysis Bot" })] }), _jsx(Button, { onClick: () => setShowSettings(!showSettings), "aria-label": "Settings", children: _jsx(Settings, { className: "w-5 h-5 text-[#7fa650]" }) })] }), _jsxs("main", { children: [_jsx("div", { className: "flex justify-between items-center mb-4", children: _jsx(Button, { onClick: toggleBot, className: `flex-1 ${isBotRunning
                                    ? "bg-red-500 hover:bg-red-600"
                                    : "bg-[#7fa650] hover:bg-[#6c8c44]"}`, children: isBotRunning ? (_jsxs(_Fragment, { children: [_jsx(CirclePause, { className: "w-4 h-4 mr-2" }), "Stop Bot"] })) : (_jsxs(_Fragment, { children: [_jsx(PlayIcon, { className: "w-4 h-4 mr-2" }), "Start Bot"] })) }) }), _jsxs("div", { className: "bg-[#1a1a1a] p-3 rounded-md mb-4", children: [_jsx("h2", { className: "text-sm font-semibold mb-2", children: "Status" }), _jsx("p", { className: "text-sm", children: isBotRunning
                                        ? "Bot is analyzing the current position..."
                                        : "Bot is inactive. Press Start to begin analysis." })] }), showSettings && (_jsxs("div", { className: "bg-[#1a1a1a] p-3 rounded-md mb-4", children: [_jsx("h2", { className: "text-sm font-semibold mb-2", children: "Settings" }), _jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("label", { htmlFor: "depth", className: "text-sm", children: "Analysis Depth" }), _jsx(Slider, { id: "depth", min: 1, max: 20, step: 1, value: [depth], onValueChange: (value) => setDepth(value[0]), className: "w-32" }), _jsx("span", { className: "text-sm ml-2", children: depth })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("label", { htmlFor: "autoPlay", className: "text-sm", children: "Auto Play Best Move" }), _jsx(Switch, { id: "autoPlay", checked: autoPlay, onCheckedChange: setAutoPlay })] })] }))] }), _jsx("footer", { className: "mt-4 text-center text-xs text-gray-400", children: "Chess Analysis Bot v1.0" })] }) }));
}
function ChessIcon(props) {
    return (_jsxs("svg", { ...props, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M8 16l-1.447.724a1 1 0 0 0-.553.894V20h12v-2.382a1 1 0 0 0-.553-.894L16 16H8z" }), _jsx("path", { d: "M8.5 16v-2.5h7V16" }), _jsx("path", { d: "M12 4v2.5" }), _jsx("path", { d: "M10.5 7.5h3" }), _jsx("path", { d: "M8 9l1 3h6l1-3" })] }));
}
