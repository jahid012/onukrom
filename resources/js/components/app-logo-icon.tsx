import type { SVGAttributes } from 'react';

/** Flat Onukrom mark: an "O" route ring with a stop dot. */
export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg {...props} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M16 4a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm0 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z"
            />
            <circle cx="24.5" cy="7.5" r="3.5" />
        </svg>
    );
}
