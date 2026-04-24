import { noop } from 'rxjs';

import { LoadingPageContent } from '../LoadingPageContent/LoadingPageContent';
import { MainPageHeader } from '../MainPageHeader/MainPageHeader';

export function LoadingPage() {
    return <>
        {/* TODO: implement persistence and remove noop */}
        <MainPageHeader
            showConnectionStatus={false}
            createNewNote={noop}
            menu={[]}
        />
        <LoadingPageContent/>
    </>;
}
