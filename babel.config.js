module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Não adicione plugins manualmente aqui.
    // Desde o SDK 50, o suporte ao expo-router e ao Reanimated/Worklets
    // já vem embutido automaticamente no babel-preset-expo.
    // Adicionar 'expo-router/babel' (como estava antes) quebra o build,
    // pois esse módulo foi removido há várias versões do expo-router.
  };
};
