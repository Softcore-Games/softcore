import { NavLink } from "./nav-link";

interface NavLinksProps {
  isLoggedIn: boolean;
  stamina?: number;
  className?: string;
}

export const NavLinks = ({
  isLoggedIn,
  stamina,
  className = "",
}: NavLinksProps) => (
  <div className={`flex flex-col items-center lg:flex-row lg:space-x-14 space-y-4 lg:space-y-0 z-10 ${className}`}>
    <NavLink href="/nft-gallery">NFT GALLERY</NavLink>
    <NavLink href="/faq">FAQ</NavLink>
    <NavLink href="/about">ABOUT</NavLink>
    <NavLink href="/contact">CONTACT</NavLink>
  </div>
);
 