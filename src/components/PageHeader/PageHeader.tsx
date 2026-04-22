import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../../const/ROUTES';
import './PageHeader.css';

export function PageHeader({
    children,
    homeButtonIcon,
}: {
    children: React.ReactNode;
    homeButtonIcon: React.ReactNode;
}) {
    const navigate = useNavigate();

    return <header className={'PageHeader'}>
        <button
            type={'button'}
            onClick={() => {
                navigate(ROUTES.home);
            }}
        >
            {homeButtonIcon}
        </button>
        {children}
    </header>;
}
