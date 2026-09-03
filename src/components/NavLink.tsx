import { Link, useLocation } from "@/lib/router-compat";
import { forwardRef, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends Omit<ComponentProps<typeof Link>, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
  end?: boolean;
}

// react-router's NavLink function-form className has no TanStack equivalent;
// active state is derived from useLocation instead (pending state is unused).
const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName: _pendingClassName, to, end, ...props }, ref) => {
    const location = useLocation();
    const path = (to ?? "").split(/[?#]/)[0] || "/";
    const isActive = end
      ? location.pathname === path
      : location.pathname === path || location.pathname.startsWith(path === "/" ? "/__never__" : `${path}/`) || (path === "/" && location.pathname === "/");
    return <Link ref={ref} to={to} className={cn(className, isActive && activeClassName)} {...props} />;
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
