import React, { useState, useEffect } from 'react';
import { RefundRequest } from '../../types';
import { refundService } from '../../services/refundService';
import { formatRupiah, formatDate } from '../../utils/formatters';
import { PinKeypad } from '../common/PinKeypad';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  AlertTriangle,
  Layers
} from 'lucide-react';

interface RefundApprovalQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const RefundApprovalQueueModal: React.FC<RefundApprovalQueueModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // State untuk dialog konfirmasi tindakan Owner
  const [selectedRequest, setSelectedRequest] = useState<RefundRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [ownerPin, setOwnerPin] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [approvalNotes, setApprovalNotes] = useState<string>('');
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string>('');

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const data = await refundService.getRefundRequests();
      setRequests(data);
    } catch (err: any) {
      showToast('Gagal memuat antrean refund: ' + (err?.message || ''), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRequests();
      setSelectedRequest(null);
      setActionType(null);
      setOwnerPin('');
      setRejectionReason('');
      setApprovalNotes('');
      setActionError('');
      setPreviewPhoto(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const pendingRequests = requests.filter(r => r.approval_status === 'pending');
  const historyRequests = requests.filter(r => r.approval_status !== 'pending');
  const displayedRequests = activeTab === 'pending' ? pendingRequests : historyRequests;

  const handleOpenAction = (req: RefundRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(req);
    setActionType(action);
    setOwnerPin('');
    setRejectionReason('');
    setApprovalNotes('');
    setActionError('');
  };

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !actionType) return;
    setActionError('');

    if (actionType === 'approve' || actionType === 'reject') {
      if (!ownerPin || ownerPin.trim().length !== 4) {
        setActionError('PIN 4 digit wajib dimasukkan.');
        return;
      }
    }

    if (actionType === 'reject' && !rejectionReason.trim()) {
      setActionError('Alasan penolakan pengajuan refund wajib diisi.');
      return;
    }

    setIsProcessingAction(true);
    try {
      if (actionType === 'approve') {
        await refundService.approveRefundRequest(selectedRequest.id, ownerPin.trim(), approvalNotes.trim());
        showToast(`Pengajuan refund #${selectedRequest.order_number} berhasil disetujui.`, 'success');
      } else if (actionType === 'reject') {
        await refundService.rejectRefundRequest(selectedRequest.id, ownerPin.trim(), rejectionReason.trim());
        showToast(`Pengajuan refund #${selectedRequest.order_number} ditolak.`, 'info');
      }

      await loadRequests();
      onSuccess();
      setSelectedRequest(null);
      setActionType(null);
    } catch (err: any) {
      const msg = err?.message || 'Gagal memproses aksi refund.';
      setActionError(msg);
      showToast(msg, 'error');
    } finally {
      setIsProcessingAction(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl bg-white dark:bg-[#1E1C1A] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#3B2A1F] text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-white/10 text-[#D4A373]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                Antrean & Otorisasi Refund Owner
              </h2>
              <p className="text-xs text-stone-300">
                Verifikasi bukti fisik, alasan kasir, dan berikan persetujuan aman dengan PIN Owner.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-stone-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-6 pt-4 border-b border-stone-200 dark:border-stone-800 flex gap-4 text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'pending'
                ? 'border-[#C68B59] text-[#C68B59]'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Menunggu Keputusan</span>
            {pendingRequests.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black">
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'history'
                ? 'border-[#C68B59] text-[#C68B59]'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Riwayat Keputusan ({historyRequests.length})</span>
          </button>
        </div>

        {/* List Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1">
          {isLoading ? (
            <div className="text-center py-12 text-stone-400 text-xs flex flex-col items-center gap-2">
              <Clock className="w-6 h-6 animate-spin text-[#C68B59]" />
              <span>Memuat data pengajuan refund...</span>
            </div>
          ) : displayedRequests.length === 0 ? (
            <div className="text-center py-12 bg-stone-50 dark:bg-[#171514] rounded-3xl border border-dashed border-stone-200 dark:border-stone-800 text-stone-400 text-xs">
              {activeTab === 'pending'
                ? 'Tidak ada pengajuan refund yang sedang menunggu persetujuan.'
                : 'Belum ada riwayat keputusan refund.'}
            </div>
          ) : (
            displayedRequests.map(req => {
              const isEmergency = req.refund_type === 'emergency';
              const isDisbursed = req.disbursement_status === 'disbursed';

              return (
                <div
                  key={req.id}
                  className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#1E1C1A] border border-stone-200 dark:border-stone-800 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    {/* Thumbnail Bukti Foto */}
                    <div
                      onClick={() => setPreviewPhoto(req.evidence_image_url)}
                      className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-stone-100 dark:bg-stone-800 overflow-hidden shrink-0 border border-stone-200 dark:border-stone-700 cursor-pointer group"
                      title="Klik untuk memperbesar bukti foto"
                    >
                      {req.evidence_image_url ? (
                        <img
                          src={req.evidence_image_url}
                          alt="Bukti Refund"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-stone-400">
                          No Photo
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Eye className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Informasi Pengajuan */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-stone-900 dark:text-stone-100 text-sm">
                          #{req.order_number}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                          {req.original_payment_method} → {req.refund_payment_method}
                        </span>

                        {isEmergency ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            Emergency Tunai
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                            Refund Normal
                          </span>
                        )}

                        {/* Status Badge */}
                        {req.approval_status === 'pending' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-200 dark:border-amber-800">
                            Pending Review
                          </span>
                        ) : req.approval_status === 'approved' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-200 dark:border-emerald-800">
                            Disetujui
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-200 dark:border-rose-800">
                            Ditolak
                          </span>
                        )}

                        {isDisbursed ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300">
                            Uang Sudah Keluar
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-500">
                            Uang Belum Keluar
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-stone-600 dark:text-stone-400">
                        Alasan: <strong className="text-stone-800 dark:text-stone-200">{req.reason}</strong>
                        {req.notes && <span className="italic ml-1">({req.notes})</span>}
                      </div>

                      <div className="text-[11px] text-stone-400 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>Diajukan oleh: {req.requested_by_name}</span>
                        <span>•</span>
                        <span>{formatDate(req.created_at)}</span>
                      </div>

                      {req.rejection_reason && (
                        <div className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/40 p-2 rounded-xl border border-rose-200 dark:border-rose-800">
                          Alasan Ditolak Owner: {req.rejection_reason}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Nominal & Actions */}
                  <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                    <span className="text-base sm:text-lg font-black text-[#3B2A1F] dark:text-[#D4A373]">
                      {formatRupiah(req.amount)}
                    </span>

                    {req.approval_status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenAction(req, 'reject')}
                          className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Tolak
                        </button>
                        <button
                          onClick={() => handleOpenAction(req, 'approve')}
                          className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Setujui</span>
                        </button>
                      </div>
                    )}

                    {/* Jika sudah disetujui tapi uang belum diserahkan (approved + not_disbursed) */}
                    {req.approval_status === 'approved' && req.disbursement_status === 'not_disbursed' && (
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Menunggu Kasir Menyerahkan Uang</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Action Confirmation Modal (PIN / Rejection Reason) */}
        {selectedRequest && actionType && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-md bg-white dark:bg-[#1E1C1A] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    {actionType === 'approve' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                    {actionType === 'reject' && <XCircle className="w-5 h-5 text-rose-600" />}
                    <span>
                      {actionType === 'approve' && 'Persetujuan Refund Oleh Owner'}
                      {actionType === 'reject' && 'Penolakan Pengajuan Refund'}
                    </span>
                  </h3>
                  <p className="text-xs text-stone-500">
                    Order #{selectedRequest.order_number} • {formatRupiah(selectedRequest.amount)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  disabled={isProcessingAction}
                  className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {actionError && (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{actionError}</span>
                </div>
              )}

              <form onSubmit={handleExecuteAction} className="space-y-3.5">
                {actionType === 'reject' && (
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                      Alasan Penolakan <span className="text-rose-500">*</span>:
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      placeholder="Masukkan alasan mengapa pengajuan refund ini ditolak..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                )}

                {actionType === 'approve' && (
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                      Catatan Owner (Opsional):
                    </label>
                    <input
                      type="text"
                      value={approvalNotes}
                      onChange={e => setApprovalNotes(e.target.value)}
                      placeholder="Catatan verifikasi..."
                      className="w-full px-3 py-2 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}

                {/* PIN Input menggunakan PinKeypad bersama */}
                <div className="pt-1">
                  <PinKeypad
                    pin={ownerPin}
                    onChange={newPin => {
                      setOwnerPin(newPin);
                      if (actionError) setActionError('');
                    }}
                    maxLength={4}
                    label="PIN OWNER UNTUK OTORISASI"
                    subtitle="Masukkan 4 digit PIN Owner Anda untuk memvalidasi tindakan ini"
                    disabled={isProcessingAction}
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedRequest(null)}
                    disabled={isProcessingAction}
                    className="px-4 py-2 rounded-2xl border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessingAction}
                    className={`px-5 py-2 rounded-2xl text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer ${
                      actionType === 'approve'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {isProcessingAction ? 'Memproses...' : 'Konfirmasi Tindakan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Lightbox Preview Foto Bukti */}
        {previewPhoto && (
          <div
            onClick={() => setPreviewPhoto(null)}
            className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in cursor-pointer"
          >
            <div className="relative max-w-2xl max-h-[90vh] bg-stone-900 rounded-3xl overflow-hidden shadow-2xl p-2 border border-stone-700">
              <img
                src={previewPhoto}
                alt="Bukti Foto Lengkap"
                className="max-w-full max-h-[85vh] object-contain rounded-2xl"
              />
              <button
                onClick={() => setPreviewPhoto(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
