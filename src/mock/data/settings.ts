import { Settings } from '../../types';

export const initialSettings: Settings = {
  store_name: 'BOOTH DAILY',
  tagline: 'Industrial Modern Coffee Booth',
  address: 'Jl. Riau No. 88, Bandung',
  phone: '081234567890',
  receipt_header: 'Terima kasih telah berkunjung ke Booth Daily!',
  receipt_footer: 'Follow Instagram @boothdaily.id | Free WiFi: boothdaily_guest',
  tax_percentage: 5,
  service_charge_percentage: 0,
  currency_symbol: 'Rp',
  operational_day_cutoff_time: '04:00',
  receipt_paper_size: '80mm',
  report_signer_name: '',
  report_city: '',
  vip_discount_percentage: 0,
  vip_tax_percentage: null,
  vip_room_service_charge_percentage: 0,
};
