
import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {}

// Icon representing a command to open a panel on the left
const PanelLeftIcon: React.FC<IconProps> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5h3v15h-3z" />
  </svg>
);
export default PanelLeftIcon;
