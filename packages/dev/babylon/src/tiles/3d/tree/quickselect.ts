/**
 * this sofware is comming from https://github.com/mourner/quickselect
 * Copyright (c) 2024, Vladimir Agafonkin
 */

/**
 * Rearranges items so that all items in the [left, k] are the smallest.
 * The k-th element will have the (k - left + 1)-th smallest value in [left, right].
 *
 * @template T
 * @param {T[]} arr the array to partially sort (in place)
 * @param {number} k middle index for partial sorting (as defined above)
 * @param {number} [left=0] left index of the range to sort
 * @param {number} [right=arr.length-1] right index
 * @param {(a: T, b: T) => number} [compare = (a, b) => a - b] compare function
 */
export default function quickselect<T>(arr: Array<T>, k: number, left = 0, right = arr.length - 1, compare: (a: T, b: T) => number) {
    while (right > left) {
        if (right - left > 600) {
            const n = right - left + 1;
            const m = k - left + 1;
            const z = Math.log(n);
            const s = 0.5 * Math.exp((2 * z) / 3);
            const sd = 0.5 * Math.sqrt((z * s * (n - s)) / n) * (m - n / 2 < 0 ? -1 : 1);
            const newLeft = Math.max(left, Math.floor(k - (m * s) / n + sd));
            const newRight = Math.min(right, Math.floor(k + ((n - m) * s) / n + sd));
            quickselect(arr, k, newLeft, newRight, compare);
        }

        const t = arr[k];
        let i = left;
        /** @type {number} */
        let j = right;

        let tmp = arr[left];
        arr[left] = arr[k];
        arr[k] = tmp;

        if (compare(arr[right], t) > 0) {
            let tmp = arr[left];
            arr[left] = arr[right];
            arr[right] = tmp;
        }

        while (i < j) {
            tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;

            i++;
            j--;
            while (compare(arr[i], t) < 0) i++;
            while (compare(arr[j], t) > 0) j--;
        }

        if (compare(arr[left], t) === 0) {
            tmp = arr[left];
            arr[left] = arr[j];
            arr[j] = tmp;
        } else {
            j++;
            tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }

        if (j <= k) left = j + 1;
        if (k <= j) right = j - 1;
    }
}
