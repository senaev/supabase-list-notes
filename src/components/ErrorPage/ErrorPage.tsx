import './ErrorPage.css';

import { FullPageContent } from '../FullPageContent/FullPageContent';
import { MainPageHeader } from '../MainPageHeader/MainPageHeader';

export function ErrorPage({
    errorMessage,
}: {
    errorMessage: string;
}) {
    return <div>
        <MainPageHeader
            showConnectionStatus={false}
            createNewNote={() => {
                // TODO: implement createNewNote on Page404 instead of passing noop
            }}
            menu={
                // TODO: implement menu on Page404 instead of passing empty array
                []
            }
        />

        <FullPageContent>
            <span className={'ErrorPage__content_emoji'}>
                {'🤷'}
            </span>
            <h1>
                {errorMessage}
            </h1>
        </FullPageContent>
    </div>;
}
