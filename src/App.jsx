import React, { useState, useMemo, useRef } from 'react';
import { Trophy, Users, Play, AlertCircle, Award, UserX, Edit2, RotateCcw, Save, Upload, Download } from 'lucide-react';

const App = () => {
  const [screen, setScreen] = useState('setup'); // setup, tournament, finished
  const [playerName, setPlayerName] = useState('');
  const [players, setPlayers] = useState([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [matches, setMatches] = useState([]);
  const [history, setHistory] = useState([]); // Para deshacer rondas

  const fileInputRef = useRef(null);

  // Calcular rondas logarítmicas
  const totalRounds = useMemo(() => {
    if (players.length === 0) return 0;
    return Math.ceil(Math.log2(players.length));
  }, [players.length]);

  // Función de mezcla (Fisher-Yates)
  const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // --- JUGADORES ---
  const addPlayer = () => {
    if (playerName.trim() && !players.find(p => p.name === playerName.trim())) {
      setPlayers([...players, {
        id: Date.now(),
        name: playerName.trim(),
        wins: 0,
        losses: 0,
        matchPoints: 0,
        opponents: [],
        hasBye: false, // Nueva propiedad para controlar que no se repita el Bye
        dropped: false
      }]);
      setPlayerName('');
    }
  };

  const removePlayer = (id) => {
    setPlayers(players.filter(p => p.id !== id));
  };

  // --- LÓGICA DEL TORNEO ---

  // Guardar foto del momento actual (Snapshots)
  const saveToHistory = () => {
    const snapshot = {
      players: JSON.parse(JSON.stringify(players)),
      matches: JSON.parse(JSON.stringify(matches)),
      currentRound,
      screen
    };
    setHistory([...history, snapshot]);
  };

  // Deshacer ronda
  const undoLastRound = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setPlayers(previousState.players);
    setMatches(previousState.matches);
    setCurrentRound(previousState.currentRound);
    setScreen(previousState.screen);
    setHistory(history.slice(0, -1));
  };

  const startTournament = () => {
    if (players.length < 2) return alert('Mínimo 2 jugadores');
    saveToHistory();
    setScreen('tournament');
    generateNextRound(true);
  };

  // --- GENERACIÓN DE EMPAREJAMIENTOS CON BYE AUTOMÁTICO ---
  const generateNextRound = (isFirstRound = false) => {
    if (!isFirstRound) saveToHistory();

    // 1. Obtener jugadores activos
    let candidates = players.filter(p => !p.dropped);
    
    if (candidates.length <= 1) {
      setScreen('finished');
      return;
    }

    // Copia temporal de jugadores para actualizar stats del Bye inmediatamente
    let updatedPlayersMap = [...players]; 
    const newMatches = [];
    const pairedIds = new Set();
    let byePlayerId = null;

    // 2. GESTIÓN DEL BYE (Si son impares)
    if (candidates.length % 2 !== 0) {
      // Ordenamos por puntos ascendente (de menor a mayor) para dar Bye al que va peor
      // Y que NO haya tenido Bye antes
      const candidatesForBye = [...candidates].sort((a, b) => a.matchPoints - b.matchPoints);
      const playerToReceiveBye = candidatesForBye.find(p => !p.hasBye);

      if (playerToReceiveBye) {
        byePlayerId = playerToReceiveBye.id;
        pairedIds.add(byePlayerId);
        
        // Crear el match de Bye
        newMatches.push({
          id: Date.now() + 9999,
          player1: playerToReceiveBye,
          player2: null,
          result: 'bye' // Resultado automático
        });

        // ACTUALIZACIÓN INMEDIATA DE PUNTOS POR EL BYE
        updatedPlayersMap = updatedPlayersMap.map(p => {
            if (p.id === byePlayerId) {
                return {
                    ...p,
                    wins: p.wins + 1,
                    matchPoints: p.matchPoints + 3, // 3 Puntos por victoria (Bye)
                    hasBye: true // Marcar que ya tuvo su Bye
                };
            }
            return p;
        });

        // Lo sacamos de la lista de candidatos para emparejar
        candidates = candidates.filter(p => p.id !== byePlayerId);
      }
    }

    // 3. EMPAREJAR AL RESTO (Shuffle + Puntos)
    // Usamos shuffle primero para aleatoriedad en misma puntuación
    candidates = shuffleArray(candidates);
    // Luego ordenamos por puntos (Los mejores contra los mejores)
    candidates.sort((a, b) => b.matchPoints - a.matchPoints);

    for (let i = 0; i < candidates.length; i++) {
      if (pairedIds.has(candidates[i].id)) continue;
      
      const player1 = candidates[i];
      let player2 = null;

      // Buscar oponente ideal
      for (let j = i + 1; j < candidates.length; j++) {
        if (pairedIds.has(candidates[j].id)) continue;
        // Evitar repetir oponentes
        if (!player1.opponents.includes(candidates[j].id)) {
          player2 = candidates[j];
          pairedIds.add(candidates[j].id);
          break;
        }
      }

      // Si no hay ideal, agarrar el siguiente disponible
      if (!player2) {
        for (let j = i + 1; j < candidates.length; j++) {
          if (!pairedIds.has(candidates[j].id)) {
            player2 = candidates[j];
            pairedIds.add(candidates[j].id);
            break;
          }
        }
      }

      if (player2) {
        pairedIds.add(player1.id);
        newMatches.push({
          id: Date.now() + i,
          player1: player1,
          player2: player2,
          result: null 
        });
      }
    }

    // Actualizamos el estado
    setPlayers(updatedPlayersMap);
    setMatches(newMatches);
    setCurrentRound(prev => prev + 1);
  };

  // --- REGISTRAR RESULTADOS ---
  const recordResult = (matchId, result) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    // Actualizar match visualmente
    const updatedMatches = matches.map(m => m.id === matchId ? { ...m, result } : m);
    setMatches(updatedMatches);

    // Actualizar estadísticas de jugadores
    const updatedPlayers = players.map(player => {
      // El BYE ya se calculó en generateNextRound, aquí solo gestionamos partidas jugadas

      if (result === 'p1win') {
        if (player.id === match.player1.id) return { ...player, wins: player.wins + 1, matchPoints: player.matchPoints + 3, opponents: [...player.opponents, match.player2.id] };
        if (player.id === match.player2.id) return { ...player, losses: player.losses + 1, opponents: [...player.opponents, match.player1.id] };
      }
      if (result === 'p2win') {
        if (player.id === match.player2.id) return { ...player, wins: player.wins + 1, matchPoints: player.matchPoints + 3, opponents: [...player.opponents, match.player1.id] };
        if (player.id === match.player1.id) return { ...player, losses: player.losses + 1, opponents: [...player.opponents, match.player2.id] };
      }
      if (result === 'doubleloss') {
        if (player.id === match.player1.id || player.id === match.player2.id) {
            const oppId = player.id === match.player1.id ? match.player2.id : match.player1.id;
            return { ...player, losses: player.losses + 1, opponents: [...player.opponents, oppId] };
        }
      }
      return player;
    });
    setPlayers(updatedPlayers);
  };

  // Editar / Deshacer resultado individual
  const undoResult = (matchId) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || !match.result) return;
    const previousResult = match.result;

    // Si intentan editar un Bye, no dejamos (porque es automático de la ronda)
    if (previousResult === 'bye') return alert("El Bye es automático, para cambiarlo usa 'Corregir Ronda Anterior'");

    const updatedMatches = matches.map(m => m.id === matchId ? { ...m, result: null } : m);
    setMatches(updatedMatches);

    const updatedPlayers = players.map(player => {
      if (previousResult === 'p1win') {
        if (player.id === match.player1.id) return { ...player, wins: player.wins - 1, matchPoints: player.matchPoints - 3, opponents: player.opponents.slice(0, -1) };
        if (player.id === match.player2.id) return { ...player, losses: player.losses - 1, opponents: player.opponents.slice(0, -1) };
      }
      if (previousResult === 'p2win') {
        if (player.id === match.player2.id) return { ...player, wins: player.wins - 1, matchPoints: player.matchPoints - 3, opponents: player.opponents.slice(0, -1) };
        if (player.id === match.player1.id) return { ...player, losses: player.losses - 1, opponents: player.opponents.slice(0, -1) };
      }
      if (previousResult === 'doubleloss') {
        if (player.id === match.player1.id || player.id === match.player2.id) {
           return { ...player, losses: player.losses - 1, opponents: player.opponents.slice(0, -1) };
        }
      }
      return player;
    });
    setPlayers(updatedPlayers);
  };

  const isRoundComplete = matches.every(m => m.result !== null);

  const nextRound = () => {
    if (currentRound >= totalRounds) {
      setScreen('finished');
    } else {
      generateNextRound();
    }
  };

  // --- PERSISTENCIA ---
  const saveTournament = () => {
    const data = { players, matches, currentRound, screen, history, date: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `yugi-torneo-${new Date().toLocaleDateString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadTournament = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.players && data.currentRound) {
          setPlayers(data.players);
          setMatches(data.matches || []);
          setCurrentRound(data.currentRound);
          setScreen(data.screen || 'setup');
          setHistory(data.history || []);
          alert("Torneo cargado correctamente");
        }
      } catch (err) { alert("Error al cargar archivo"); }
    };
    reader.readAsText(file);
  };

  const standings = useMemo(() => {
    return [...players].sort((a, b) => {
      if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.losses - b.losses;
    });
  }, [players]);

  const resetTournament = () => {
    if(!confirm("¿Borrar todo y empezar de cero?")) return;
    setScreen('setup');
    setPlayers([]);
    setCurrentRound(0);
    setMatches([]);
    setHistory([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4 md:p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-8 gap-4">
            <div className="flex items-center gap-3">
                <Trophy className="w-8 h-8 md:w-10 md:h-10 text-yellow-400" />
                <div>
                    <h1 className="text-xl md:text-3xl font-bold">YugiManager Pro</h1>
                    <p className="text-xs md:text-sm text-purple-300">Sistema Suizo Oficial</p>
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={saveTournament} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded text-sm font-medium transition">
                    <Save size={16}/> <span className="hidden sm:inline">Guardar</span>
                </button>
                <button onClick={() => fileInputRef.current.click()} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded text-sm font-medium transition">
                    <Upload size={16}/> <span className="hidden sm:inline">Cargar</span>
                </button>
                <input type="file" ref={fileInputRef} onChange={loadTournament} className="hidden" accept=".json"/>
            </div>
        </div>

        {screen === 'setup' && (
          <div className="bg-slate-800/50 backdrop-blur rounded-lg p-4 md:p-6 shadow-xl border border-slate-700">
            <h2 className="text-xl md:text-2xl font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 md:w-6 md:h-6" /> Registro
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 mb-6">
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
                placeholder="Nombre del duelista..."
                className="flex-1 px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-purple-500 transition"
              />
              <button onClick={addPlayer} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold transition">
                + Agregar
              </button>
            </div>
            {players.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-6 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {players.map((player, idx) => (
                    <div key={player.id} className="flex justify-between items-center bg-slate-700/50 px-3 py-2 rounded border border-slate-600">
                      <span className="truncate">{idx + 1}. {player.name}</span>
                      <button onClick={() => removePlayer(player.id)} className="text-slate-400 hover:text-red-400"><UserX size={16}/></button>
                    </div>
                  ))}
                </div>
                <button onClick={startTournament} className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-bold text-lg shadow-lg flex items-center justify-center gap-2">
                  <Play size={20} /> COMENZAR TORNEO
                </button>
              </>
            )}
          </div>
        )}

        {screen === 'tournament' && (
          <div className="space-y-4 md:space-y-6 animate-fade-in">
            <div className="bg-slate-800/80 backdrop-blur rounded-xl p-4 md:p-6 shadow-2xl border border-slate-700 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

              <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-3">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">Ronda {currentRound} <span className="text-sm font-normal text-slate-400">/ {totalRounds}</span></h2>
                    <p className="text-xs text-purple-300 uppercase tracking-wider font-bold mt-1">Sistema Suizo</p>
                </div>
                {history.length > 0 && (
                    <button onClick={undoLastRound} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition border border-slate-600">
                        <RotateCcw size={16} /> Corregir Ronda Anterior
                    </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {matches.map((match, idx) => (
                  <div key={match.id} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50 hover:border-purple-500/30 transition-colors">
                    <div className="flex justify-between items-center mb-3 text-xs uppercase font-bold text-slate-500">
                        <span>Mesa {idx + 1}</span>
                        {match.result && match.result !== 'bye' && (
                            <button onClick={() => undoResult(match.id)} className="text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800 px-2 py-1 rounded">
                                <Edit2 size={10} /> Editar
                            </button>
                        )}
                    </div>

                    {match.result === 'bye' ? (
                         <div className="text-center py-4 bg-yellow-900/20 rounded border border-yellow-500/20">
                            <span className="text-yellow-400 font-bold flex items-center justify-center gap-2"><Trophy size={16}/> BYE (Victoria Automática)</span>
                            <p className="mt-2 text-lg font-bold text-white">{match.player1.name}</p>
                            <p className="text-xs text-slate-400 mt-1">+3 Puntos asignados</p>
                         </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-center mb-4">
                                <div className={`flex-1 text-center ${match.result === 'p1win' ? 'text-green-400 font-bold' : ''}`}>
                                    <p className="text-lg leading-tight">{match.player1.name}</p>
                                    <p className="text-[10px] text-slate-500">{match.player1.matchPoints} pts</p>
                                </div>
                                <div className="px-2 text-slate-600 font-black italic">VS</div>
                                <div className={`flex-1 text-center ${match.result === 'p2win' ? 'text-green-400 font-bold' : ''}`}>
                                    <p className="text-lg leading-tight">{match.player2.name}</p>
                                    <p className="text-[10px] text-slate-500">{match.player2.matchPoints} pts</p>
                                </div>
                            </div>
                            {!match.result && (
                                <div className="flex gap-2">
                                    <button onClick={() => recordResult(match.id, 'p1win')} className="flex-1 py-2 bg-slate-700 hover:bg-green-600 rounded text-xs font-bold transition">GANA P1</button>
                                    <button onClick={() => recordResult(match.id, 'doubleloss')} className="px-3 py-2 bg-slate-800 hover:bg-red-600 border border-slate-700 rounded text-xs font-bold transition text-slate-400 hover:text-white" title="Doble Derrota">DL</button>
                                    <button onClick={() => recordResult(match.id, 'p2win')} className="flex-1 py-2 bg-slate-700 hover:bg-green-600 rounded text-xs font-bold transition">GANA P2</button>
                                </div>
                            )}
                            {match.result === 'doubleloss' && <div className="text-center text-xs text-red-400 font-bold bg-red-900/20 py-1 rounded">DOBLE DERROTA</div>}
                        </>
                    )}
                  </div>
                ))}
              </div>

              {isRoundComplete && (
                <button onClick={nextRound} className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:brightness-110 rounded-lg font-bold text-lg shadow-lg animate-pulse">
                  {currentRound >= totalRounds ? 'FINALIZAR TORNEO 🏆' : 'SIGUIENTE RONDA ➡️'}
                </button>
              )}
            </div>

            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-4 border border-slate-700">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Clasificación en vivo</h3>
                <div className="space-y-1">
                    {standings.map((p, i) => (
                        <div key={p.id} className="flex justify-between text-sm py-1 border-b border-slate-700/50 last:border-0">
                            <span><span className="text-slate-500 font-mono w-6 inline-block">{i+1}.</span> {p.name}</span>
                            <span className="font-bold text-purple-400">{p.matchPoints} pts</span>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        )}

        {screen === 'finished' && (
          <div className="bg-slate-800/80 backdrop-blur rounded-xl p-8 shadow-2xl text-center border border-slate-700 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-500 via-purple-500 to-yellow-500"></div>
            <Trophy className="w-24 h-24 text-yellow-400 mx-auto mb-6 animate-bounce drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
            <h2 className="text-4xl font-black mb-2 text-white">¡TORNEO FINALIZADO!</h2>
            
            <div className="mb-8 mt-6">
                <div className="inline-block bg-gradient-to-b from-slate-800 to-slate-900 p-6 rounded-2xl border border-yellow-500/30 shadow-2xl transform hover:scale-105 transition">
                    <span className="text-yellow-500 text-xs font-black uppercase tracking-[0.2em]">Campeón</span>
                    <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 mt-2 mb-1">
                        {standings[0]?.name}
                    </div>
                    <div className="text-slate-400 text-sm">Récord: {standings[0]?.wins} victorias - {standings[0]?.losses} derrotas</div>
                </div>
            </div>

            <div className="bg-slate-900/50 rounded-xl overflow-hidden border border-slate-700 text-left">
                <div className="bg-slate-900 p-3 text-xs font-bold text-slate-500 uppercase flex">
                    <div className="w-12 text-center">Pos</div>
                    <div className="flex-1">Duelista</div>
                    <div className="w-20 text-center">Puntos</div>
                    <div className="w-20 text-center">W-L</div>
                </div>
                <div className="divide-y divide-slate-800">
                    {standings.map((player, idx) => (
                        <div key={player.id} className={`flex py-3 px-2 ${idx === 0 ? 'bg-yellow-500/10' : 'hover:bg-slate-800/50'}`}>
                            <div className="w-12 text-center font-mono text-slate-500 font-bold">{idx + 1}</div>
                            <div className="flex-1 font-medium flex items-center gap-2">
                                {player.name} 
                                {idx === 0 && <Trophy size={12} className="text-yellow-500"/>}
                            </div>
                            <div className="w-20 text-center font-bold text-purple-400">{player.matchPoints}</div>
                            <div className="w-20 text-center text-xs text-slate-500">{player.wins}-{player.losses}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-8 flex gap-4 justify-center">
                <button onClick={resetTournament} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold text-slate-300 transition">
                    Nuevo Torneo
                </button>
                 <button onClick={saveTournament} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold text-white transition shadow-lg shadow-purple-900/20">
                    Guardar
                </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;