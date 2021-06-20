/**
 * ensures that there won't be more than `maxParallel` enqueued actions running at same time
 */
const ParallelActionsQueue = (maxParallel: number) => {
    const actionsQueue: (() => Promise<void>)[] = [];
    let actionsInProgress = 0;
    const tryTakeNext = () => {
        if (actionsInProgress < maxParallel) {
            const next = actionsQueue.shift();
            if (next) {
                ++actionsInProgress;
                next().finally(() => {
                    --actionsInProgress;
                    tryTakeNext();
                });
            }
        }
    };

    const enqueue = <T>(action: () => T | Promise<T>): Promise<T> => {
        return new Promise((resolve, reject) => {
            actionsQueue.push(() => {
                return Promise.resolve()
                    .then(action)
                    .then(resolve, reject);
            });
            tryTakeNext();
        });
    };

    return {
        enqueue: enqueue,
    };
};

export default ParallelActionsQueue;
