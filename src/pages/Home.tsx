import WebSocketDemo from '../components/WebSocketDemo';
import ConnectionStatus from '../components/ConnectionStatus';
import ConnectionTest from '../components/ConnectionTest';
import ConnectionVerifierComponent from '../components/ConnectionVerifier';

const Home = () => {
  return (
    <div>
      <h1>Welcome to Machinations</h1>
      <ConnectionVerifierComponent />
      <ConnectionStatus />
      <ConnectionTest />
      <WebSocketDemo />
    </div>
  );
};

export default Home;
