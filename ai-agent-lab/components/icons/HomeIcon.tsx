
import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {}

const HomeIcon: React.FC<IconProps> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.5 1.5 0 012.122 0l8.954 8.955M21 12v9a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 21v-9m18 0a2.25 2.25 0 00-2.25-2.25h-1.5a2.25 2.25 0 00-2.25 2.25M3 12a2.25 2.25 0 012.25-2.25h1.5A2.25 2.25 0 019 12m0 9H9m12 0h-3m-6 0h-3v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21z" />
  </svg>
);
export default HomeIcon;
