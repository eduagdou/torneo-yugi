import React, { useState, useMemo } from 'react';
import { Trophy, Users, Play, AlertCircle, Award, UserX, Menu } from 'lucide-react';

const App = () => {
  const [screen, setScreen] = useState('setup'); // setup, tournament, finished
  const [playerName, setPlayerName] = useState('');
  const [players, setPlayers] = useState([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [matches, setMatches] = useState([]);
  const [matchHistory, setMatchHistory] = useState([]);

  // Calcular número de rondas suizas
  const totalRounds = useMemo(() => {
    if (players.length === 0) return 0;
    return Math.ceil(Math.log2(players.length));
  }, [players.length]);

  // Agregar jugador
  const addPlayer = () => {
    if (playerName.trim() && !players.find(p => p.name === playerName.trim())) {
      setPlayers([...players, {
        id: Date.now(),
        name: playerName.trim(),
        wins: 0,
        losses: 0,
        matchPoints: 0,
        opponents: [],
        eliminated: false
      }]);
      setPlayerName('');
    }
  };

  // Eliminar jugador
  const removePlayer = (id) => {
    setPlayers(players.filter(p => p.id !== id));
  };

  // Iniciar torneo
  const startTournament = () => {
    if (players.length < 2) {
      alert('Se necesitan al menos 2 jugadores');
      return;
    }
    setScreen('tournament');
    generateNextRound();
  };

  // Generar emparejamientos
  const generateNextRound = () => {
    const activePlayers = players.filter(p => !p.eliminated);
    
    if (activePlayers.length === 0) {
      setScreen('finished');
      return;
    }

    if (activePlayers.length === 1) {
      setScreen('finished');
      return;
    }

    // Ordenar jugadores por puntos
    const sorted = [...activePlayers].sort((a, b) => {
      if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
      return b.wins - a.wins;
    });

    const newMatches = [];
    const paired = new Set();

    // Emparejar jugadores con puntos similares
    for (let i = 0; i < sorted.length; i++) {
      if (paired.has(sorted[i].id)) continue;

      const player1 = sorted[i];
      let player2 = null;

      // Buscar oponente que no haya enfrentado antes
      for (let j = i + 1; j < sorted.length; j++) {
        if (paired.has(sorted[j].id)) continue;
        if (!player1.opponents.includes(sorted[j].id)) {
          player2 = sorted[j];
          paired.add(sorted[j].id);
          break;
        }
      }

      // Si no encuentra oponente sin repetir, toma cualquiera disponible
      if (!player2) {
        for (let j = i + 1; j < sorted.length; j++) {
          if (!paired.has(sorted[j].id)) {
            player2 = sorted[j];
            paired.add(sorted[j].id);
            break;
          }
        }
      }

      if (player2) {
        paired.add(player1.id);
        newMatches.push({
          id: Date.now() + i,
          player1: player1,
          player2: player2,
          result: null // null, 'p1win', 'p2win', 'doubleloss'
        });
      }
    }

    // Si hay número impar, dar BYE al último
    if (sorted.length % 2 === 1) {
      const byePlayer = sorted.find(p => !paired.has(p.id));
      if (byePlayer) {
        newMatches.push({
          id: Date.now() + 999,
          player1: byePlayer,
          player2: null,
          result: 'bye'
        });
      }
    }

    setMatches(newMatches);
    setCurrentRound(currentRound + 1);
  };

  // Registrar resultado
  const recordResult = (matchId, result) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    // Actualizar resultado del match
    const updatedMatches = matches.map(m => 
      m.id === matchId ? { ...m, result } : m
    );
    setMatches(updatedMatches);

    // Guardar en historial
    setMatchHistory([...matchHistory, { ...match, result, round: currentRound }]);

    // Actualizar estadísticas de jugadores
    const updatedPlayers = players.map(player => {
      if (result === 'bye' && player.id === match.player1.id) {
        return {
          ...player,
          wins: player.wins + 1,
          matchPoints: player.matchPoints + 3
        };
      }

      if (result === 'p1win') {
        if (player.id === match.player1.id) {
          return {
            ...player,
            wins: player.wins + 1,
            matchPoints: player.matchPoints + 3,
            opponents: [...player.opponents, match.player2.id]
          };
        }
        if (player.id === match.player2.id) {
          const newLosses = player.losses + 1;
          return {
            ...player,
            losses: newLosses,
            opponents: [...player.opponents, match.player1.id],
            eliminated: newLosses >= 2
          };
        }
      }

      if (result === 'p2win') {
        if (player.id === match.player2.id) {
          return {
            ...player,
            wins: player.wins + 1,
            matchPoints: player.matchPoints + 3,
            opponents: [...player.opponents, match.player1.id]
          };
        }
        if (player.id === match.player1.id) {
          const newLosses = player.losses + 1;
          return {
            ...player,
            losses: newLosses,
            opponents: [...player.opponents, match.player2.id],
            eliminated: newLosses >= 2
          };
        }
      }

      if (result === 'doubleloss') {
        if (player.id === match.player1.id || player.id === match.player2.id) {
          const newLosses = player.losses + 1;
          const opponentId = player.id === match.player1.id ? match.player2.id : match.player1.id;
          return {
            ...player,
            losses: newLosses,
            opponents: [...player.opponents, opponentId],
            eliminated: newLosses >= 2
          };
        }
      }

      return player;
    });

    setPlayers(updatedPlayers);
  };

  // Verificar si la ronda está completa
  const isRoundComplete = matches.every(m => m.result !== null);

  // Avanzar a siguiente ronda
  const nextRound = () => {
    if (currentRound >= totalRounds) {
      setScreen('finished');
    } else {
      generateNextRound();
    }
  };

  // Calcular standings
  const standings = useMemo(() => {
    return [...players].sort((a, b) => {
      if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.losses - b.losses;
    });
  }, [players]);

  // Reiniciar torneo
  const resetTournament = () => {
    setScreen('setup');
    setPlayers([]);
    setCurrentRound(0);
    setMatches([]);
    setMatchHistory([]);
  };

  return (
    // RESPONSIVE: Padding reducido en móvil (p-4), normal en PC (md:p-6)
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-3 mb-2">
            <Trophy className="w-10 h-10 md:w-12 md:h-12 text-yellow-400" />
            {/* RESPONSIVE: Texto más pequeño en móvil */}
            <h1 className="text-2xl md:text-4xl font-bold">Yu-Gi-Oh! Tournament</h1>
          </div>
          <p className="text-sm md:text-base text-purple-300">Sistema Suizo con Doble Loss</p>
        </div>

        {/* Setup Screen */}
        {screen === 'setup' && (
          <div className="bg-slate-800/50 backdrop-blur rounded-lg p-4 md:p-6 shadow-xl">
            <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 md:w-6 md:h-6" />
              Registro de Jugadores
            </h2>

            {/* RESPONSIVE: Flex-col en móvil (input arriba, botón abajo), fila en PC */}
            <div className="flex flex-col sm:flex-row gap-2 mb-6">
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
                placeholder="Nombre del jugador"
                className="flex-1 px-4 py-3 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={addPlayer}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition w-full sm:w-auto"
              >
                Agregar
              </button>
            </div>

            {players.length > 0 && (
              <>
                <div className="bg-slate-700/50 rounded-lg p-3 md:p-4 mb-6">
                  <h3 className="font-semibold mb-3">Jugadores Registrados ({players.length})</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {players.map((player, idx) => (
                      <div key={player.id} className="flex items-center justify-between bg-slate-600/50 px-3 py-2 rounded">
                        <span className="truncate mr-2">{idx + 1}. {player.name}</span>
                        <button
                          onClick={() => removePlayer(player.id)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-4 mb-6">
                  <p className="text-sm text-purple-200">
                    <strong>Rondas suizas:</strong> {totalRounds} rondas
                  </p>
                  <p className="text-xs text-purple-300 mt-1">
                    • Sistema de doble eliminación<br/>
                    • Emparejamiento por puntos
                  </p>
                </div>

                <button
                  onClick={startTournament}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-bold text-lg transition flex items-center justify-center gap-2 shadow-lg"
                >
                  <Play className="w-5 h-5" />
                  Iniciar Torneo
                </button>
              </>
            )}
          </div>
        )}

        {/* Tournament Screen */}
        {screen === 'tournament' && (
          <div className="space-y-4 md:space-y-6">
            {/* Round Info */}
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-4 md:p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-2">
                <h2 className="text-xl md:text-2xl font-bold">
                  Ronda {currentRound} de {totalRounds}
                </h2>
                <div className="text-sm text-purple-300 bg-purple-900/50 px-3 py-1 rounded-full">
                  {players.filter(p => !p.eliminated).length} jugadores activos
                </div>
              </div>

              {/* Matches */}
              <div className="space-y-3 md:space-y-4 mb-6">
                {matches.map((match, idx) => (
                  <div key={match.id} className="bg-slate-700/50 rounded-lg p-3 md:p-4 border border-slate-600/30">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-600/50 pb-2">
                      <span className="text-purple-300 font-semibold text-sm">Mesa {idx + 1}</span>
                      {match.result && (
                        <span className="text-xs bg-green-600 px-2 py-0.5 rounded text-white font-medium">Completado</span>
                      )}
                    </div>

                    {match.player2 === null ? (
                      <div className="text-center py-2">
                        <p className="font-semibold text-lg">{match.player1.name}</p>
                        <p className="text-sm text-green-400 font-medium">BYE (Victoria automática)</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex-1">
                            <p className="font-bold text-base md:text-lg leading-tight">{match.player1.name}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {match.player1.wins}W - {match.player1.losses}L
                            </p>
                          </div>
                          
                          <div className="px-2 md:px-4">
                            <span className="text-purple-400 font-black text-xl">VS</span>
                          </div>

                          <div className="flex-1 text-right">
                            <p className="font-bold text-base md:text-lg leading-tight">{match.player2.name}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {match.player2.wins}W - {match.player2.losses}L
                            </p>
                          </div>
                        </div>

                        {!match.result && (
                          // RESPONSIVE: Botones en Grid, se apilan en móvil
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <button
                              onClick={() => recordResult(match.id, 'p1win')}
                              className="py-3 bg-green-600/90 hover:bg-green-600 rounded transition text-sm font-medium"
                            >
                              Gana {match.player1.name.split(' ')[0]}
                            </button>
                            
                            {/* En movil este boton queda en medio */}
                            <button
                              onClick={() => recordResult(match.id, 'doubleloss')}
                              className="py-3 bg-slate-600 hover:bg-red-600/80 rounded transition text-xs font-bold text-gray-300 hover:text-white border border-slate-500"
                            >
                              Doble Loss
                            </button>

                            <button
                              onClick={() => recordResult(match.id, 'p2win')}
                              className="py-3 bg-blue-600/90 hover:bg-blue-600 rounded transition text-sm font-medium"
                            >
                              Gana {match.player2.name.split(' ')[0]}
                            </button>
                          </div>
                        )}

                        {match.result === 'doubleloss' && (
                          <div className="mt-2 bg-red-900/30 border border-red-500/30 rounded p-2 text-center text-sm">
                            <AlertCircle className="w-4 h-4 inline mr-1" />
                            Ambos pierden
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>

              {isRoundComplete && (
                <button
                  onClick={nextRound}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-bold text-lg shadow-lg animate-pulse"
                >
                  {currentRound >= totalRounds ? 'Finalizar Torneo' : 'Siguiente Ronda ->'}
                </button>
              )}
            </div>

            {/* Standings */}
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-4 md:p-6 shadow-xl">
              <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
                <Award className="w-5 h-5" />
                Tabla de Posiciones
              </h3>
              <div className="space-y-2">
                {standings.map((player, idx) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      player.eliminated
                        ? 'bg-red-900/20 border-red-500/20 opacity-70'
                        : idx === 0
                        ? 'bg-yellow-900/20 border-yellow-500/40'
                        : 'bg-slate-700/30 border-slate-600/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className={`font-bold w-6 ${idx === 0 ? 'text-yellow-400' : 'text-gray-400'}`}>
                        {idx + 1}
                      </span>
                      <span className="font-semibold truncate">{player.name}</span>
                      {player.eliminated && (
                        <span className="hidden sm:inline-block text-[10px] bg-red-600 px-1.5 py-0.5 rounded uppercase tracking-wider">Elim</span>
                      )}
                    </div>
                    <div className="text-right whitespace-nowrap pl-2">
                      <p className="font-bold text-sm md:text-base">{player.matchPoints} pts</p>
                      <p className="text-xs text-gray-400">
                        {player.wins}W - {player.losses}L
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Finished Screen */}
        {screen === 'finished' && (
          <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 shadow-xl text-center">
            <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4 animate-bounce" />
            <h2 className="text-3xl font-bold mb-6">¡Torneo Finalizado!</h2>

            <div className="bg-gradient-to-br from-yellow-900/40 to-purple-900/40 border-2 border-yellow-500/50 rounded-xl p-6 mb-8 transform hover:scale-105 transition duration-300">
              <h3 className="text-xl font-bold mb-2 text-yellow-200">🏆 CAMPEÓN 🏆</h3>
              <p className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200 mb-2 truncate">
                {standings[0]?.name}
              </p>
              <p className="text-lg text-purple-200">
                Puntaje Perfecto: {standings[0]?.matchPoints} pts
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {standings.slice(1, 3).map((player, idx) => (
                   <div key={player.id} className="bg-slate-700/40 p-4 rounded-lg border border-slate-600">
                      <p className="text-gray-400 text-sm">{idx + 2}° Lugar</p>
                      <p className="text-xl font-bold">{player.name}</p>
                      <p className="text-xs text-gray-500">{player.matchPoints} pts</p>
                   </div>
                ))}
            </div>

            <button
              onClick={resetTournament}
              className="w-full py-4 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold transition text-gray-300"
            >
              Iniciar Nuevo Torneo
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;