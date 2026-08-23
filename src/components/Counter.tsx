import { useAppStore } from '../store/useAppStore';

export default function Counter() {
  const { count, increment, decrement, reset } = useAppStore();

  return (
    <div className="flex flex-col gap-2 items-center">
      <h2 className="text-xl">Count: {count}</h2>
      <div className="flex gap-2">
        <button onClick={increment}>+1</button>
        <button onClick={decrement}>-1</button>
        <button onClick={reset}>Reset</button>
      </div>
    </div>
  );
}
