import './MainPageHeader.css';

import { PlusCircleIcon } from '@heroicons/react/24/outline';

import { APP_TITLE } from '../../const/APP_TITLE';
import { ConnectionStatusIndicator } from '../ConnectionStatusIndicator/ConnectionStatusIndicator';
import { ContextMenu, ContextMenuItem } from '../ContextMenu/ContextMenu';
import { PageHeader } from '../PageHeader/PageHeader';
import appLogoUrl from '/logo.svg';

export function MainPageHeader({
    createNewNote,
    menu,
}: {
    createNewNote: VoidFunction;
    menu: ContextMenuItem[];
}) {
    return <PageHeader
        homeButtonIcon={
            <img
                className={'MainPageHeader__logo'}
                src={appLogoUrl}
                alt={'Home'}
            />
        }
    >
        <h1 className={'MainPageHeader__appTitle'}>
            {APP_TITLE}
        </h1>
        <ConnectionStatusIndicator/>
        <button
            type={'button'}
            aria-label={'Add note'}
            onClick={createNewNote}
        >
            <PlusCircleIcon className={'MainPageHeader__icon'}/>
        </button>
        <ContextMenu items={menu}/>
    </PageHeader>;
}
