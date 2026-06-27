import SettingsKodi from '@app/components/Settings/SettingsKodi';
import SettingsLayout from '@app/components/Settings/SettingsLayout';
import type { NextPage } from 'next';

const KodiSettingsPage: NextPage = () => {
  return (
    <SettingsLayout>
      <SettingsKodi />
    </SettingsLayout>
  );
};

export default KodiSettingsPage;
