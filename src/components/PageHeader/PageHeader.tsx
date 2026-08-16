import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../../const/ROUTES';
import { clearLastSelectedItemType } from '../../utils/lastSelectedItemType';
import './PageHeader.css';

export function PageHeader({
    children,
    homeButtonIcon,
}: {
    children: React.ReactNode;
    homeButtonIcon: React.ReactNode;
}) {
    const navigate = useNavigate();

    return (
        <header className={'PageHeader'}>
            <button
                type={'button'}
                onClick={() => {
                    clearLastSelectedItemType();
                    navigate(ROUTES.home);
                }}
            >
                {homeButtonIcon}
            </button>
            {children}
        </header>
    );
}
