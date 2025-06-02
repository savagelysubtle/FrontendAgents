
import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {}

const ToolIcon: React.FC<IconProps> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.528-1.032.062-2.331-.98-2.85L7.43 8.047l-2.121 2.122L12.17 15.95l2.496-3.031m-3.065-6.352l2.851.98c1.032.528 2.331.062 2.85-1.032L18.015 2.25l-2.122-2.121L10.072 5.952c-1.032.528-1.56.855-1.032 2.85zm-6.352 3.065l2.85.98 2.85-1.032-5.7-2.85-2.85 5.7 1.032-2.85z" />
  </svg>
);
export default ToolIcon;
