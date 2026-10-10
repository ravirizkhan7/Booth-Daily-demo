import { useState } from 'react';
import { Settings } from '../../types';

export const defaultSettings: Settings = {
  store_name: 'BOOTH DAILY',
  tagline: 'Industrial Modern Coffee Booth',
  address: '',
  phone: '',
  receipt_header: 'Terima kasih telah berkunjung!',
  receipt_footer: '',
  tax_percentage: 0,
  service_charge_percentage: 0,
  currency_symbol: 'Rp'
};

export const usePOSSettings = () => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  return {
    settings,
    setSettings,
  };
};
