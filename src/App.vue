<script setup>
import MainComponent from "@/components/MainComponent.vue";
</script>

<template>
  <header>
    <h1>Wortelus ETH Crowdfunding</h1>
    <p>Máte zajímavý projekt nebo přání které si chcete splnit ? :)
      Nemáte rádi banky a daně ?
      Chcete být cypherpunk a s prachama zmizet na Bahamské ostrovy ?
      Pak jste na správném místě!
    </p>
    <img alt="Ethereum logo" class="logo" src="./assets/logo.svg" width="125" height="125"/>
  </header>

  <main>
    <MainComponent/>
  </main>
</template>

<style scoped>
header {
  line-height: 1.5;
}

.logo {
  display: block;
  margin: 64px 0 24px 0;
}

@media (min-width: 1024px) {
  header {
    place-items: center;
    padding: 32px calc(var(--section-gap) / 2) 0 0;
  }

  .logo {
    margin: 16px 0 auto 0;
  }
}
</style>
