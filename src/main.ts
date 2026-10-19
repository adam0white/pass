import './ui/style.css';
import { _debug, start } from './ui/app.ts';

if (import.meta.env.DEV) (window as unknown as { __pass: typeof _debug }).__pass = _debug;
start();
