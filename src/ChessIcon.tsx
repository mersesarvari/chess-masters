import React from "react";

export default function ChessIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M8 16l-1.447.724a1 1 0 0 0-.553.894V20h12v-2.382a1 1 0 0 0-.553-.894L16 16" />
      <path d="M7 16V3h10v13" />
      <path d="M12 7l-1 3h2l-1 3" />
    </svg>
  );
}
