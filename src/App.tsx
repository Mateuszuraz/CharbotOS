/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { SettingsProvider } from '@/context/SettingsContext';
import { SessionProvider } from '@/context/SessionContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { RoomProvider } from '@/context/RoomContext';
import { Layout } from '@/components/Layout';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { OnboardingWizard, isOnboardingDone } from '@/components/OnboardingWizard';
import { CustomCursor } from '@/components/CustomCursor';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState(!isOnboardingDone());

  return (
    <>
      <CustomCursor />
      {loading && <LoadingScreen onDone={() => setLoading(false)} />}
      <LanguageProvider>
        <SettingsProvider>
          <SessionProvider>
            <RoomProvider>
              {!loading && onboarding
                ? <OnboardingWizard onDone={() => setOnboarding(false)} />
                : <Layout />
              }
            </RoomProvider>
          </SessionProvider>
        </SettingsProvider>
      </LanguageProvider>
    </>
  );
}
