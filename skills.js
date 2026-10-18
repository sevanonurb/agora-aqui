// skills.js — o absorvedor de skills.
// Lê o manifesto, carrega cada skill e as FUNDE numa base { lugares, cartoes } para o kernel.
// Adicionar um país ou domínio = soltar um arquivo em skills/ e citá-lo no manifest. O kernel não muda.
// `leitor(caminho)` devolve o JSON já parseado — no navegador via fetch, no node via fs.

export async function carregarSkills(leitor, manifest = 'skills/manifest.json') {
  const man = await leitor(manifest);
  const lugares = {}, cartoes = [], skills = [];
  for (const arq of man.skills) {
    const sk = await leitor('skills/' + arq);
    Object.assign(lugares, sk.lugares || {});
    for (const c of (sk.cartoes || []))
      cartoes.push({ ...c, _skill: sk.id, _pais: sk.pais, _dominio: sk.dominio });
    skills.push({ id: sk.id, pais: sk.pais, dominio: sk.dominio, nome: sk.nome,
                  versao: sk.versao, cartoes: (sk.cartoes || []).length });
  }
  return { versao: 'skills-1.0', lugares, cartoes, skills };
}

// perfil da situação a partir das escolhas do usuário (o que faz skills de recém/país aparecerem)
export function montarPerfil({ dalvrij = false, modo = 'recem', destino = '' } = {}) {
  const p = [];
  if (dalvrij) p.push('dalvrij');
  if (modo === 'recem') p.push('recem');
  if (destino) p.push(destino);          // ex.: 'espanha' → liga a skill es-chegar
  return p;
}
