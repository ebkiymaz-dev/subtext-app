package com.neonjungle.subtext;

/** Process-local, one-time screenshot handoff. Nothing is written to disk. */
final class PendingCaptureStore {
    static final class Item {
        final byte[] bytes;
        final String type;

        Item(byte[] bytes, String type) {
            this.bytes = bytes;
            this.type = type;
        }
    }

    private static Item pending;

    private PendingCaptureStore() { }

    static synchronized void put(byte[] bytes, String type) {
        pending = bytes == null ? null : new Item(bytes, type);
    }

    static synchronized Item take() {
        Item item = pending;
        pending = null;
        return item;
    }

    static synchronized void clear() {
        pending = null;
    }
}
