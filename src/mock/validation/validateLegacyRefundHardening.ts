import * as React from 'react';
import { mockStore } from '../store';
import { orderService } from '../../services/orderService';
import { usePOSOrders } from '../../context/pos/usePOSOrders';
import { setStorageDriver, resetStorageDriver, NodeMemoryStorageDriver } from '../persistence/storage';

// Minimal dispatcher mock for running React custom hook in Node test runner
const clientInternals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
if (clientInternals) {
  clientInternals.H = {
    useState: (init: any) => [init, () => {}],
    useCallback: (fn: any) => fn,
    useEffect: () => {},
    useRef: (init: any) => ({ current: init }),
    useMemo: (fn: any) => fn(),
  };
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✓ PASS: ${msg}`);
}

export async function runLegacyRefundHardeningTests() {
  console.log('==================================================================');
  console.log('   BOOTH DAILY — LEGACY REFUND HARDENING & BYPASS DEFENSE SUITE   ');
  console.log('==================================================================');

  const memoryDriver = new NodeMemoryStorageDriver();
  setStorageDriver(memoryDriver);

  const store = mockStore;
  const ownerUser = store.getSnapshot().users.find(u => u.role === 'owner')!;
  store.openShift({ cash_initial: 100000, user: ownerUser });

  // Setup seed order
  const seedOrder = store.addOrder({
    order_number: 'ORD-HARDEN-01',
    order_type: 'dine_in',
    subtotal: 30000,
    tax: 0,
    discount: 0,
    total_amount: 30000,
    payment: {
      id: 'pay-harden-01',
      order_id: '',
      method: 'cash',
      amount_paid: 30000,
      change: 0,
      status: 'completed',
    },
    items: [
      {
        id: 'it-01',
        product_id: 'prd-americano',
        product_name: 'Americano Classic',
        price: 30000,
        qty: 1,
        subtotal: 30000,
        unit_cost_price: 8000,
        subtotal_cost: 8000,
        is_estimated_cost: false,
      }
    ],
    created_at: new Date().toISOString(),
  });

  console.log('\n--- UJI 1: Proteksi Jalur Operasional POS (usePOSOrders) ---');
  let toastMessage = '';
  let toastType = '';
  const dummyToast = (msg: string, type?: any) => {
    toastMessage = msg;
    toastType = type;
  };

  const posOrders = usePOSOrders({
    currentUser: { id: 'usr-owner-01', role: 'owner' },
    onStockChange: () => {},
    showToast: dummyToast,
  });

  // Jalur operasional usePOSOrders.refundOrder WAJIB menolak direct refund
  const posRes = await posOrders.refundOrder(seedOrder.id, {
    refund_reason: 'Bypass attempt from UI',
  });

  assert(posRes.success === false, 'S01: POSContext/usePOSOrders.refundOrder menolak direct refund (success === false)');
  assert(posRes.message.includes('Direct refund dinonaktifkan'), 'S01: Pesan error menegaskan direct refund dinonaktifkan pada jalur operasional');
  assert(toastType === 'error', 'S01: Toast bertipe error dimunculkan ke antarmuka');
  const postPosOrder = store.getOrderById(seedOrder.id)!;
  assert(postPosOrder.payment?.status === 'completed', 'S01: Status transaksi TETAP completed (tidak dibatalkan)');

  console.log('\n--- UJI 2: Proteksi Runtime Browser pada orderService.refundOrder ---');
  // Simulasikan runtime browser (window defined)
  (global as any).window = {};
  let threwBrowserOrderService = false;
  try {
    await orderService.refundOrder(seedOrder.id, {
      refunded_by_name: 'Attacker',
      refund_reason: 'Rogue console call',
    });
  } catch (err: any) {
    threwBrowserOrderService = true;
    assert(err.message.includes('Direct refund legacy dinonaktifkan'), 'S02: orderService.refundOrder melempar error saat window runtime terdeteksi');
  }
  assert(threwBrowserOrderService, 'S02: orderService.refundOrder berhasil memblokir direct call pada runtime browser');

  console.log('\n--- UJI 3: Proteksi Runtime Browser pada mockStore.refundOrder ---');
  let threwBrowserStore = false;
  try {
    store.refundOrder(seedOrder.id, {
      refunded_by_name: 'Attacker',
      refund_reason: 'Rogue store call',
    });
  } catch (err: any) {
    threwBrowserStore = true;
    assert(err.message.includes('Direct refund legacy dinonaktifkan'), 'S03: mockStore.refundOrder melempar error saat window runtime terdeteksi');
  }
  assert(threwBrowserStore, 'S03: mockStore.refundOrder berhasil memblokir direct call pada runtime browser');

  // Bersihkan simulasi window
  delete (global as any).window;

  console.log('\n--- UJI 4: Proteksi Mutasi Ilegal Status Payment via updateOrder ---');
  let threwUpdateOrder = false;
  try {
    store.updateOrder(seedOrder.id, {
      payment: {
        id: seedOrder.payment!.id,
        order_id: seedOrder.id,
        method: 'cash',
        amount_paid: 30000,
        change: 0,
        status: 'refunded',
      },
    });
  } catch (err: any) {
    threwUpdateOrder = true;
    assert(err.message.includes("status pembayaran pesanan menjadi 'refunded' dilarang"), 'S04: updateOrder melempar error saat mencoba mengubah status ke refunded');
  }
  assert(threwUpdateOrder, 'S04: updateOrder berhasil memblokir backdoor mutasi status menjadi refunded');

  console.log('\n--- UJI 5: Kompatibilitas Mundur Unit Test (Node.js Test Runner) ---');
  // Dalam lingkungan Node.js (window undefined), orderService.refundOrder tetap berfungsi
  // untuk melayani test fixture lama (validateDataIntegrity, validateHPPPhase3, validatePhase4, validateShiftSystem)
  const legacyRefunded = await orderService.refundOrder(seedOrder.id, {
    refunded_by_name: 'Test Runner',
    refund_reason: 'Legacy Test Compatibility',
    refund_method: 'cash',
  });
  assert(legacyRefunded.payment?.status === 'refunded', 'S05: orderService.refundOrder tetap kompatibel untuk unit test legacy');
  assert(legacyRefunded.refund_method === 'cash', 'S05: Metadata refund method legacy tersimpan');

  // Dalam browser jika diberi flag isInternalTest eksplisit
  (global as any).window = {};
  const seedOrder2 = store.addOrder({
    order_number: 'ORD-HARDEN-02',
    order_type: 'dine_in',
    subtotal: 25000,
    tax: 0,
    discount: 0,
    total_amount: 25000,
    payment: {
      id: 'pay-harden-02',
      order_id: '',
      method: 'cash',
      amount_paid: 25000,
      change: 0,
      status: 'completed',
    },
    items: [
      {
        id: 'it-02',
        product_id: 'prd-americano',
        product_name: 'Americano Classic',
        price: 25000,
        qty: 1,
        subtotal: 25000,
        unit_cost_price: 8000,
        subtotal_cost: 8000,
        is_estimated_cost: false,
      }
    ],
    created_at: new Date().toISOString(),
  });

  const internalTestRefund = store.refundOrder(seedOrder2.id, {
    refunded_by_name: 'Browser Internal Fixture',
    isInternalTest: true,
  });
  assert(internalTestRefund.payment?.status === 'refunded', 'S06: mockStore.refundOrder mengizinkan bypass HANYA jika flag isInternalTest diberikan');
  delete (global as any).window;

  resetStorageDriver();

  console.log('\n==================================================================');
  console.log('   ALL LEGACY REFUND HARDENING TESTS PASSED (100%)');
  console.log('==================================================================');
}

runLegacyRefundHardeningTests().catch(err => {
  console.error('Hardening test execution failed:', err);
  process.exit(1);
});
