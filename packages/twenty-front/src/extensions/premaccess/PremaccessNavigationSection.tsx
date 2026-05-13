import { useLingui } from '@lingui/react/macro';
import { useLocation } from 'react-router-dom';
import { IconRefresh } from 'twenty-ui/icon';

import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import { NavigationDrawerSection } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSection';
import { NavigationDrawerSectionTitle } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSectionTitle';

export const PREMACCESS_NAVIGATION_PATH = '/premaccess/';

/**
 * Sidebar entry for the Premaccess extension.
 *
 * Upstream deleted `NavigationDrawerOtherSection` (the previous host of this
 * item) and moved Settings into the drawer mode switcher, so the entry now
 * lives in its own section under the workspace objects, mounted by a
 * single line in `MainNavigationDrawerScrollableItems`.
 */
export const PremaccessNavigationSection = () => {
  const { t } = useLingui();
  const { pathname } = useLocation();

  return (
    <NavigationDrawerSection>
      <NavigationDrawerSectionTitle label={t`Premaccess`} />
      <NavigationDrawerItem
        label={t`CRM Sync`}
        Icon={IconRefresh}
        to={PREMACCESS_NAVIGATION_PATH}
        active={pathname.startsWith(PREMACCESS_NAVIGATION_PATH)}
      />
    </NavigationDrawerSection>
  );
};
