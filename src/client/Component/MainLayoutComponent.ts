import { throttle } from 'lodash';
import * as m from 'mithril';
import HeaderViewModel from '../ViewModel/HeaderViewModel';
import MainLayoutViewModel from '../ViewModel/MainLayoutViewModel';
import StorageViewModel from '../ViewModel/Storage/StorageViewModel';
import factory from '../ViewModel/ViewModelFactory';
import { BalloonComponent } from './BalloonComponent';
import Component from './Component';
import { HeaderArgs, HeaderComponent } from './HeaderComponent';
import HeaderMenuComponent from './HeaderMenuComponent';
import NavigationComponent from './NavigationComponent';
import SnackbarComponent from './Snackbar/SnackbarComponent';
import StorageComponent from './Storage/StorageComponent';

interface MainLayoutArgs {
    header?: HeaderArgs;
    content?: m.Children | m.Children[] | null;
    notMainContent?: m.Children | m.Children[];
    menuWidth?: number;
    menuContent?: { attrs: { [key: string]: any }; text: string }[];
    mainLayoutStyle?: string;
    scrollStoped?(position: number): void;
}

/**
 * MainLayoutComponent
 */
class MainLayoutComponent extends Component<MainLayoutArgs> {
    private viewModel: MainLayoutViewModel;

    constructor() {
        super();
        this.viewModel = <MainLayoutViewModel> factory.get('MainLayoutViewModel');
    }

    /**
     * view
     */
    public view(vnode: m.Vnode<MainLayoutArgs, this>): m.Children {
        let main: m.Child;
        if (typeof vnode.attrs.content !== 'undefined') {
            main = m('main', {
                id: MainLayoutComponent.id,
                class: 'mdl-layout__content non-scroll main-layout-animation',
                oncreate: (mainVnode: m.VnodeDOM<void, any>) => {
                    if (typeof vnode.attrs.scrollStoped === 'undefined') { return; }

                    let url = location.href;
                    (<HTMLElement> (mainVnode.dom)).addEventListener('scroll', throttle(() => {
                        if (url !== location.href) {
                            url = location.href;

                            return;
                        }
                        if (typeof vnode.attrs.scrollStoped !== 'undefined') {
                            vnode.attrs.scrollStoped((<HTMLElement> (mainVnode.dom)).scrollTop);
                        }
                    }, 50), false);
                },
                onupdate: (mainVnode: m.VnodeDOM<void, any>) => {
                    (<HTMLElement> mainVnode.dom).style.opacity = this.viewModel.isShow() ? '1' : '0';
                },
            }, [
                m('div', { class: 'page-content' }, vnode.attrs.content),
            ]);
        }

        const attr: { [key: string]: any } = { class: 'mdl-layout mdl-js-layout mdl-layout--fixed-header' };
        if (typeof vnode.attrs.mainLayoutStyle !== 'undefined') {
            attr.style = vnode.attrs.mainLayoutStyle;
        }

        return m('div', attr, [
            typeof vnode.attrs.header === 'undefined' ? m(HeaderComponent) : m(HeaderComponent, vnode.attrs.header),
            m(NavigationComponent),
            main,
            vnode.attrs.notMainContent,
            m(BalloonComponent, {
                id: HeaderViewModel.menuId,
                content: m(HeaderMenuComponent, {
                    content: vnode.attrs.menuContent,
                }),
                maxWidth: typeof vnode.attrs.menuWidth === 'undefined' ? 160 : vnode.attrs.menuWidth,
                verticalOnly: true,
            }),
            m(BalloonComponent, {
                id: StorageViewModel.id,
                content: m(StorageComponent),
                maxWidth: 250,
                maxHeight: 260,
                forceDialog: true,
            }),
            m(SnackbarComponent),
        ]);
    }
}

namespace MainLayoutComponent {
    export const id = 'main-layout';
}

export default MainLayoutComponent;

