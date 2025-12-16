import * as React from 'react';
import { cn } from '@/lib/utils';
import { navigationMenuTriggerStyle } from './navigation-menu-trigger-style';

// Minimal, stable navigation menu wrapper.
// This intentionally avoids Radix primitives to prevent render/update loops seen in Header.

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width="16"
    height="16"
    aria-hidden="true"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const NavigationMenu = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('relative z-10 flex max-w-max flex-1 items-center justify-center', className)}
    {...props}
  >
    {children}
    <NavigationMenuViewport />
  </div>
));
NavigationMenu.displayName = 'NavigationMenu';

const NavigationMenuList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('group flex flex-1 list-none items-center justify-center space-x-1', className)}
    {...props}
  >
    {children}
  </div>
));
NavigationMenuList.displayName = 'NavigationMenuList';

const NavigationMenuItem: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => (
  <div {...props}>{children}</div>
);

const NavigationMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => (
  <button ref={ref} className={cn(navigationMenuTriggerStyle(), 'group', className)} {...props}>
    {children} <ChevronDownIcon className="relative top-[1px] ml-1 h-3 w-3 transition duration-300" />
  </button>
));
NavigationMenuTrigger.displayName = 'NavigationMenuTrigger';

const NavigationMenuContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn('left-0 top-0 w-full md:absolute md:w-auto', className)} {...props}>
    {children}
  </div>
));
NavigationMenuContent.displayName = 'NavigationMenuContent';

const NavigationMenuLink = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement>
>(({ className, children, ...props }, ref) => (
  <a ref={ref} className={cn('inline-block', className)} {...props}>
    {children}
  </a>
));
NavigationMenuLink.displayName = 'NavigationMenuLink';

const NavigationMenuViewport = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div className={cn('absolute left-0 top-full flex justify-center', className)}>
    <div ref={ref} className={cn('origin-top-center relative mt-1.5 rounded-md border bg-popover text-popover-foreground shadow', className)} {...props} />
  </div>
));
NavigationMenuViewport.displayName = 'NavigationMenuViewport';

const NavigationMenuIndicator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden', className)} {...props}>
    <div className="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border shadow-md" />
  </div>
));
NavigationMenuIndicator.displayName = 'NavigationMenuIndicator';

export {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
};
