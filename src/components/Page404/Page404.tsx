import './Page404.css';

import { FullPageContent } from '../FullPageContent/FullPageContent';
import { MainPageHeader } from '../MainPageHeader/MainPageHeader';

export function Page404() {
    return <div>
        <MainPageHeader
            createNewNote={() => {
                // TODO: implement createNewNote on Page404 instead of passing noop
            }}
            menu={
                // TODO: implement menu on Page404 instead of passing empty array
                []
            }
        />

        <FullPageContent>
            <span className={'Page404__content_emoji'}>
                {'🤷'}
            </span>
            <h1>
                {'404: Not found'}
            </h1>
        </FullPageContent>
    </div>;
}
