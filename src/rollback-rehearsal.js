import { createHash } from "node:crypto";

export const ROLLBACK_REHEARSAL_CONTRACT = "perl-application-rollback-rehearsal/1.0";
export const ROLLBACK_REHEARSAL_BOUNDARY = "This verifies local last-known-good compatibility and safety replay. It does not restore a deployable artifact, change the running application, perform an Azure rollback, or authorize clinical release.";

const files = [
  ["app.js", "7a46020d5f85b7ed0de53788773ff883141eeec0c467bd52ad8cf5322b7cc2d7"],
  ["index.html", "3370ed0fe3e8e18c7664544ac03591cdbefb20300c1a79c73a444ef5eb1fbefc"],
  ["styles.css", "3c765cad7c7bd25044b37741c58daab9d63f2a28782ba637e95579bc7d3f2de0"],
  ["fieldwork.css", "fe064c3697ce8f73572a319439f00bdfae4ab822d9fc598ec4147d5790cbb9c8"],
  ["report.css", "fb0f2762c61005ed0ca9e082c6b6009c6182e7141ef642ab3b1998de0575baf1"],
  ["progress-report.css", "22ab917b9ce0f19c640ee2daa11fe69ca855cf9c1813f6c6d03f1493c8db8a86"],
  ["report.js", "9f273c1f9903ddef82534d8e58f52e88b816d7987e57bc15451818b5a6d9659c"],
  ["language-review.css", "c923ac746008c9580b27ae2940d0aa9f76677e32142dd5219971192c2475ec6c"],
  ["language-review-print.js", "46a76c04f78544aabfe9fae5a0b916c039eba317c5b7e940b5e349b18c2aa696"],
  ["report-assembly.css", "f12733b167b30f6daa7184e49094b400de260e8231dbff1438a9f053eff7a050"],
  ["report-assembly-print.js", "c7a896d8c712c66fddccab77c5db4df83f79c409fd96dfa474cbb636671f8ec2"],
  ["decision-exchange.css", "f8299496eaf719ad2dadf8e1d49d44e59d122427c9aac701c28517dd9de3e43f"],
  ["decision-exchange-print.js", "7993656953421caa8e112f9b83825066107da39bb218fde2b22c39b36ffe98e4"],
  ["pilot-operations.css", "0689f43e4bc4d24a886c7b5f585b22d767c0ee3205d62f64c35614ca5e76dedd"],
  ["pilot-operations-print.js", "4e74c36cf80033bff7b05acaeb1b9ab39ca606c01d52c6a41bf888241c93afe6"],
  ["provider-activation.css", "6c150d38841ca61a2b14f34a50fe5ca223868bd7cc3bc7e65e0553202bca46f0"],
  ["provider-activation-print.js", "76d27c01fe72b996f98b75926532dda9ddbed469a0eaf332ca20af3d6a864c90"],
  ["site-admission.css", "d601ae94faa0289bee547f64f3028341e87cbf867add97b39fbb31f31ab69a29"],
  ["site-admission-print.js", "42f8c56e7a395c618ac303f963901f401bdc1f5710790bb6113746277137b0f2"],
  ["authority-trust.css", "961027edebb69855a269eca8da53d8c3daca67e040aa8a1aa40cec4589ec6a2a"],
  ["pilot-start.css", "5c2dae7cac12df9bec500b60d6dcbb15f3fca00b7a15d9c71ba058a3e05a4f71"],
  ["clinical-release.css", "12f7355b4333bba01e5dfbf85ecfce29d8847551ecfe552b30642eda823aa062"],
  ["traffic-activation.css", "dab6100c5b1c5be76f46fb4aba2140aedf05ea48d860b10e5ad082cdb5b6cc59"],
  ["identity-access.css", "4732beaaa11053b27726f95c3b798a5d8b6a4138863d9ffb8419670a200c5b02"],
  ["campus-observatory.css", "a729f05feab1ed29803686413a7e19c6d0df714be7841234e64bbba4d74f76f5"],
  ["candidate-return.css", "d30e17a67df19b72472f44316c73d2418df495349309ab3c4fbc7bc320fe7e35"],
  ["candidate-blind-review.css", "f4f245cf1d970c8b78c846dd5757c2a6080701badb0d93e68b2558c2e531abe1"],
  ["candidate-refinement-retest.css", "f829692df1f741a8e200f2d8ccef99db483583013439e2eb60da19cbb2f25843"],
  ["candidate-retest-rereview.css", "84d91dff0f0133db46007ab7262b8cdb7414298f4bcd49b335321609a3a4d131"],
  ["candidate-retest-disposition.css", "d2c1c9ea5a46900c9d33cc9312c5414f56103c249cd1d56f26c8cee5196d9bcc"],
  ["candidate-advancement.css", "127cf67185223383c44c272d2161122390c22fd3b1d11387a7f9a08c55b56049"],
  ["server.mjs", "d89e7297e89335aaab95ce5df6f8b5172fcf453e4844ede21624d13b98847c07"],
  ["src/api-client.js", "c9db0a1cc5787a14611534f22ece14790780bf031a911921a226381aa57ef3e0"],
  ["src/sandbox-store.js", "baa2408606340d3464180b2445682d164d48e793516233c78b0b3fe19a31b566"],
  ["src/engine.js", "3539bf08898ef7775d9112cb79d5f25939d7d4d663b850019287168bf514040f"],
  ["src/test-form-entry.js", "e1733e85b894258a41ca76da33b87ae6935443668ab1db6b3d8edb39ac77d43a"],
  ["src/clinical-brief.js", "6a697f0f43bf65e76d12bfc5f884984af2a7bbdcf1329367e1aa2944debc5ffe"],
  ["src/model-gateway.js", "db4bd0b3e5e8844d0e1dee87004d6c307e8af29ade1824ee6ea1530b7e599ba9"],
  ["src/model-input.js", "2efbfc9c6f7a50479116e2185d7a878429c583b65bcbd12dabfdb553c0da1eb7"],
  ["src/model-provider.js", "2eed70df99e56e6e8a87c166c51ebf4bb0108f44bd2ec42d72b9cde7cbcbd459"],
  ["src/model-transport.js", "ff299883d5df738fa3b628bde428d3e6caf847bc4ed9021a2750a880c72e024f"],
  ["src/release-candidate.js", "774d7dd5b088c46a3c3be9ac13702c933f17d1d6bedc669b16c4e09984aed7e6"],
  ["src/runtime-envelope.js", "35354e8928433bbbf9155240fe2bbf3971f52b255c4780f11d600ed13507c1a7"],
  ["src/release-admission.js", "09af277e2874b074d93bd2dbb0c1738d4154de384d257e37394c08b6d3eba4c0"],
  ["src/release-promotion.js", "4539323524496eaecb5e19745c385dc2575ef1b8f8bbb113e3c65174a409c497"],
  ["src/model-trial.js", "a8f38a7826d1aa49f151444b2cc4c005d7f09bb3966f5650c2f97d1ac00f3448"],
  ["src/candidate-trial.js", "b8f310cf08104fca0cb5a941a332b3c5caad44f61c4b72100a3ee8da734a9c02"],
  ["src/candidate-return.js", "34d65d718d968e12eb349265b6e80fddcbfba8aa1b0f901130a13a99aec3b798"],
  ["src/candidate-blind-review.js", "1dcfef6498a687cd4882e1b827d9dfcafbe1e1a48261acbe708542242147ce89"],
  ["src/candidate-refinement-retest.js", "bcc7f8081d46246bb65049f5ef3ebded603d738ed267148a6ea4ff5eef042806"],
  ["src/candidate-retest-return.js", "5d3b8b0ec040919f1cd7524605ff76e284b6685cc5bd45fb0ace9cfdaf90bb49"],
  ["src/candidate-retest-rereview.js", "b5c6daf741d6273d4bb4a91e0da8cd578792aa7e3275985f128be844f433a8be"],
  ["src/candidate-retest-disposition.js", "a3d06954b3be4b2575d0629e0d96f2e606ec0472b98984847ded3cb0a3e23ffc"],
  ["src/candidate-advancement.js", "5511cd08bbe79cdbd8ca41997cbe76186c0e763292e540e0f96840714d2fcfad"],
  ["src/intended-use.js", "2c900ad9305e81854e50defaa7f4f0360410792c46e82663939a78f60d87c1e1"],
  ["src/decision-exchange.js", "93509db57ec79005e91da5073b35f66986f04e3703c0280c0b0ac484548e1281"],
  ["src/pilot-operations.js", "b7c83499f884d308df12b09617c505499dd1a48bfc4c8d00596a5157b3c9c436"],
  ["src/provider-activation.js", "18294c526e67c7a83e85c2a2d1e1d4a1dc762c9ea8cf85c4108c8aa5425fef3d"],
  ["src/campus-observatory.js", "8eb8965a40386d30a65f79c99f1191077a5c1768bb778e0f8e77ee01a0bb9a16"],
  ["src/site-admission.js", "8db30aefd5fa2291cf1ccde39d545574163753c7e5c5d2ec8e21ddccb5fd8344"],
  ["src/authority-trust.js", "d7950c721cd9c02a159c843f96a4c913c292099bae135625818eb8773ede92a7"],
  ["src/pilot-start.js", "7f09e83a8f8990c930d2568e0d22d3e67ddc7fe275c5e003e4a4b62b84e0220a"],
  ["src/clinical-release.js", "f74f445ce273a56c39470afa9045a436767b3b0f73fc51875645f6d880af88e9"],
  ["src/traffic-activation.js", "bfa0d102c2cd2d7c60116a33dee9a701d02acea5f290ae5e428a95114ba7b101"],
  ["src/identity-access.js", "9fde25a967dddf76ade627d2bd19955777b4d16908486c48dec13ed70ce0a596"],
  ["src/language-review.js", "033edf34151d14a8fc0293b8b4533221005a2bf4679ebf3775c8535c4170a83b"],
  ["src/language-review-page.js", "894cfb8514a7efda2e8e513a75db78acb465ec93f52fea1530bb2107dbba88c2"],
  ["src/report-page.js", "114d38ecf612f8fadb1328f661fe0c2df6ac7b096851ad5c65caeacea99d13af"],
  ["src/report-assembly.js", "dc8ac741f7c6afa45c137b42cb11859152c1fa103aacafb0e3d2a9173bf51c33"],
  ["src/audience-handoff-page.js", "40190d628ef2ae0f03f8faaa2f96e2043a0420ebcfff1c1b92ba06a7f864e533"],
  ["src/release-evidence.js", "e55febb04841c775a0b5f8063dbadd707a833ba0f67b47907cc1a59a52881577"],
  ["src/calibration-manifest.js", "97562ec5ba243a7c517ebc3505309aea83541f7076706818b7397a7ed35a9427"],
  ["src/calibration-intake.js", "88d84e7ce86f224f604082e666b1b58138faad8d1fcbac82b57f32521e8ab39b"],
  ["src/counselor-lab.js", "5aaffd157b502a5b89ad4ee0bec39ad0ec1b80d238f3623d268f8930af3b4933"],
  ["src/counselor-notebook.js", "81b6f6d3d9cf2f7538d8dcb3f2d2434b6dbfc3a8646700c1e358db1be046ca00"],
  ["src/counselor-reference.js", "7993dfec4b92274bf2ad478cd1e64c67ef2eb231562c4a92c35f351ecb1254c3"],
  ["src/counselor-reference-adjudication.js", "ce858cdfe2ce7933f00f24ff87d792fe9395127a78f199f855fd8a6c002826a5"],
  ["src/counselor-reference-decision.js", "e953bc0f061a64108a120d53b8b6dfa040596bdce3b031fe34ff4fd182e74000"],
  ["src/progress-review.js", "b8379d14fe5d3c5ef8b14e1aeb9f794b7ecf5e58ef36af6831dd4bc6ce84ecf5"],
  ["src/progress-report-page.js", "f484be526bcbc20a4979e3195dced5ed24ced1746c1b8438c9f8dfe31aeb36f0"],
  ["src/clinical-standard.js", "cffd718f64c40ee1c818e85b60c26ed4d6487a9ab8de5b9fb69c4a508d0c9c88"],
  ["src/independent-review.js", "45173a401b4d2a6f7464dfd6cc5c412616f755941af91dcd988c66ab903e9884"],
  ["src/independent-review-admission.js", "c1356eb1a7a2f7d45ddb87cb990216427727ec434f316bf42e1aa475ebaa82b8"],
  ["src/integration-return.js", "7ad6aa0fd1e1d631aa815156fa462deaceff650a6e637fb66dec4ac4234b304e"],
  ["src/integration-rehearsal.js", "89acf9ef54ec328fa957854969daf7c13b84e5381e08eb7cff33d427847d5baa"],
  ["src/workspace-experience.js", "e628c8455937a7e31f719d873fcbb1c5e1974fdf521f81bea810d15ca467e99f"],
  ["src/deployment-presentation.js", "695f8a32e8bb5776b6219688a7f93aa2ac2dead60f0f734d1004303b1b35643d"],
  ["src/operational-monitoring.js", "7424fe29815c0df55dc0e9179625f0e66b02f606f301ec97a313264bee05f18d"],
  ["src/incident-response.js", "5f3b043365f9c0bfe8e69a745db83150e5494a6aa12fa7919a835cf85a2d7041"],
  ["src/pilot-readiness.js", "afe1f05d008cca2d28cf813bcd5d8c7b87cb18ec2b7c1295ebd11a193e898cb4"],
  ["src/executive-handoff.js", "04f5a936402ac13f9e1d62a5473fc6af67994678f52ba3ff3520690628d53402"],
  ["schemas/assessment.schema.json", "44582a5d8b9fa8396014f0532c65c720b6254116a603d48607397c3d2ee02077"],
  ["schemas/clinical-interpretation.schema.json", "ea4310d6ed3228e1a226b9b44588f277584e6e3406101e1a779f468a1c7e58bb"],
  ["schemas/clinical-summary.schema.json", "265607e863a9d77ede57e8dd65f3f25b75657eb2d8070b32c6926faeff2317a3"],
  ["schemas/clinical-brief.schema.json", "44db47ef4f7a1fa679ab144073826737977d3500bc6b17d5132b37707baa719f"],
  ["schemas/generation-snapshot.schema.json", "922eceb82c315aa7995e7253b79345ecf6bb3a82cd498d463f143e1ea337e732"],
  ["schemas/model-transport-policy.schema.json", "9aa8d838c27002cc80c5f14b87201c8493273c0392daa7d15d1df2fd4b7e2b5b"],
  ["schemas/model-trial-preflight-event.schema.json", "d858d34fda6a289ad4d6822bb0b325e0942a77c9ac04a6f979a36f634d06e43e"],
  ["schemas/candidate-trial-planning-snapshot-event.schema.json", "38ce5e72a89d5e950107cce5b3afd19735895ce6dcfc6e85d1fe62b2f3435dca"],
  ["schemas/candidate-return-event.schema.json", "c2e8ab9adc6c2db9093f10caf206cd16fdfa688b418451eeff8801d583dc21ae"],
  ["schemas/candidate-blind-review-event.schema.json", "7c9858ae4b76c34eda0365af2b9d92b21f105daff4007006f131ac0e2fb98d35"],
  ["schemas/candidate-refinement-retest-event.schema.json", "5a70b997ae61cd2f5d33da0898b2e4f777fb5d72b1b53b2b3b4f5d5574ac3525"],
  ["schemas/candidate-retest-return-event.schema.json", "8cfe14b10938b0aa7c7c34440c03acd8230f5396eb651810d635cfdf595d7046"],
  ["schemas/candidate-retest-rereview-event.schema.json", "3ae82d584e2451376cfaa0d163e0c5c5bb5b9cd2e1e20d6f3fa99b7b3a6feed0"],
  ["schemas/candidate-retest-disposition-registry.schema.json", "660ef119041bbae7c0432bb08b186140256c1199ea03ec9a5629d70db997ad7f"],
  ["schemas/candidate-retest-disposition-challenge.schema.json", "6aea2a38ebb758fd79cede46bde6723ba42ab1c8e73a4cd08391631244ec9782"],
  ["schemas/candidate-retest-disposition-attestation.schema.json", "00661bd3e4bce417e63be532b4a35ed1821ed95fc80314510f139ec6931370f0"],
  ["schemas/candidate-retest-disposition-event.schema.json", "0e2a762f73b7e6ed7f657dbedefe2dc730ddff32a20285f9b131fb662ea6b68a"],
  ["schemas/candidate-advancement-registry.schema.json", "a394d0706c7642ef2c5b4d49605f5d3b22f5ee5c2fe1631f88035e88b9314f22"],
  ["schemas/candidate-advancement-challenge.schema.json", "b3a32999caf9c9c365c3e5565e29be2e3d282e5fd9c2545aade3ea78a085c66a"],
  ["schemas/candidate-advancement-attestation.schema.json", "fa9d28b6611704e1795ebbfc89c14288f9b6702f28c40fa5abda2c9132cd005e"],
  ["schemas/candidate-advancement-event.schema.json", "3d5e13c79e4e4c98116276437d220042340e156d60ef3f656e49a9ceac5ffdf1"],
  ["schemas/integration-rehearsal-observatory.schema.json", "f759f0b011ecbf6569a8bd28eb20dcfe91a93347985802ba9dab8e91249b8245"],
  ["schemas/intended-use-draft-event.schema.json", "d21ab39e990454321c5ab670b662af9fba401d17738cfe32b90c214544c2979b"],
  ["schemas/language-review-packet-event.schema.json", "7eb9fd9ea8d095522628352c0b7c0912365a3dcd2cabcbf4ed734b9292f56c4b"],
  ["schemas/pilot-operations-snapshot-event.schema.json", "8659eee17d4e35d47e5e1e9cebe7e28a9a5113c375b5beec4f0b9006cb06e397"],
  ["schemas/provider-activation-workbook-snapshot-event.schema.json", "b2d97f87e0b709c99e6d93b9715208a8a2a1e743c2b435ab5447e082008bb46d"],
  ["schemas/campus-observatory-snapshot-event.schema.json", "db26b4f918ac6bd39bf06d78ac7d45ddbbd5ce4a86a13690594c782908aa16e0"],
  ["schemas/site-admission-return-preflight-event.schema.json", "4769f06a2f937a6c11e8314753476f1d03c0fb8db3a276c21c84b462fff22ad2"],
  ["schemas/authority-trust-event.schema.json", "4b9791fd710a49cefffb683508177ef9a4f8aa5780ae9233b3f5443f76b86df9"],
  ["schemas/pilot-start-event.schema.json", "b22fa0face516db0ae6f0517ab0796ec34240fe6ee73ee10f36a4ef6cb899bc2"],
  ["schemas/clinical-release-event.schema.json", "7e4089898b15c9987314816f514a97b3a101cfe12efa6fae01a17fd45931fbb7"],
  ["schemas/traffic-activation-event.schema.json", "35c733c805eec115986e9dfa3e35ad4286bd6379c34115653f056277600df3b5"],
  ["schemas/identity-access-event.schema.json", "8fd66f017ac1dbce3e6f1d691a50b3b5078d705b441e32df0d7433ccaccb7d18"],
  ["schemas/report-artifact.schema.json", "8ad72b71c7e30ff09c999d52193657af4f29e501a773eeeb2bd92a53d12faf90"],
  ["schemas/release-evidence.schema.json", "05fc69ad1df0157d16e3bdbf3d43b287e5c7625831a662893d1f8f21edebc700"],
  ["schemas/release-candidate-manifest.schema.json", "90c793cad86fdb40841ff9fd490cbb70a2124610656af61f4cb923ef96181d37"],
  ["schemas/release-admission-report.schema.json", "92d3b356690413e26850480d6688c612f91b142686b9128c36345089e9e0966b"],
  ["schemas/release-promotion-request.schema.json", "7a7760282bcb0b3e46d657e20a2839e23b1dda9ff1ebbbfebf03a335c7445925"],
  ["schemas/release-promotion-attestation.schema.json", "894fae6cd14d61ac6527ddc4c25e4d955b89f21f829bb37ad0dc3561fadec9be"],
  ["schemas/runtime-envelope-policy.schema.json", "cd565f4e91868c9638d73b4454fb50e3a29e94062b22305aa737bec8955984cd"],
  ["schemas/release-signature-envelope.schema.json", "095ae35c014555c565f82520a84b4633983b57dc418734893c87f620a0954254"],
  ["schemas/release-trust-policy.schema.json", "2db7b7c056c314445e0c393a74dc7dccf23115aef91d85be5ca9e6e8ab4925f2"],
  ["schemas/operational-monitoring-event.schema.json", "a793889266571109445d4e3e80f88c033fc2a5a72f47a5eff8c1bc3bbc25eb83"],
  ["schemas/incident-response-rehearsal-event.schema.json", "766b62b4dbf3be4623d05d7afc12391460cfa72d640f279948c83510810f7963"],
  ["schemas/pilot-readiness-snapshot-event.schema.json", "8f013b5ec781509186c46f7e9a2d675b8249dc1fc42121a4d2775654e54ce40a"],
  ["schemas/clinical-standard-draft-event.schema.json", "4f3ef94ca0fbeda4b7a670e1adb1ca1a3612faaeca064c6435bfe447d9ca54dd"],
  ["schemas/independent-review-dossier-event.schema.json", "ec6804a5aada3d2742e12bfbd060c5facc473dca3c58204135c2f605696b11e9"],
  ["schemas/independent-review-admission-registry.schema.json", "48e4b43fc61e7efc2e0f0e005f7c4c3ada4ecca2994ae3918b8ba5e239ab648b"],
  ["schemas/independent-review-admission-challenge.schema.json", "44ce4d45ff50728f2a5434cf7f074ad1d015dfeafa1a12cfe89700a75eace0ba"],
  ["schemas/independent-review-admission-attestation.schema.json", "73f350451a1fa8d1363e71bd3a4912d1f835e9f1e3d86b507e738ab6139ebeea"],
  ["schemas/independent-review-admission-event.schema.json", "c24987c1ad2158a091da0125a8fdbbd643bc696ce6b4fc332380b865ba96e6c1"],
  ["schemas/eqpass-owner-return-preflight-event.schema.json", "850960be81e97ff52829a15e96d8141e5a31552d22e968f7756ea335b13ff9a9"],
  ["schemas/counselor-session-notebook-event.schema.json", "233a3a411695e6f953508c3a140f2028171bd271d75c44e70dee08777a23de1b"],
  ["schemas/counselor-reference-draft-event.schema.json", "73c926fd233b05ce614d396e088cecf909624fdcba78d417af100b5052bb8492"],
  ["schemas/counselor-reference-adjudication-event.schema.json", "876433c5f2be088eded142365dd40855732c671d460c9595b59b28d1f5b121ee"],
  ["schemas/counselor-reference-decision-registry.schema.json", "8be6d66f39c8c54616043a16e4589aaedb7558fe8d4bae5ea303fdc700d3e120"],
  ["schemas/counselor-reference-decision-challenge.schema.json", "94adb84a5f42c456c6aef98baf81efdd07fa34c9ac5df711f5b482bc8d40d18b"],
  ["schemas/counselor-reference-decision-attestation.schema.json", "455ca63c1fe8f5ac774ba0d55a69a432c6a265978de71dba1aaa18e5a1a01771"],
  ["schemas/counselor-reference-decision-event.schema.json", "b288ff8b8d142c186f1d98a635b1280c19b459a7af818cd028058857b1a385e4"],
  ["schemas/progress-review-event.schema.json", "0ca94f1394f57666700ef812779919358dce2aefa755e5268eaa7dd69abce5fc"],
  ["schemas/workspace-experience.schema.json", "095c3541e57b2903b6abbedbf68aa94296eb2f95b47a4765dd01feaf30fd4bc6"],
  ["schemas/deployment-presentation.schema.json", "62f6fd42027eb6ddb9111d1523c119963aed9061639ce8f8ea837b838cad3bb7"]
];

export const LOCAL_LAST_KNOWN_GOOD = Object.freeze({
  id: "perl-local-lkg-2026-08-18",
  version: "2026.08.18.48",
  status: "local-engineering-baseline",
  artifactRepository: "working-tree-only",
  deployableArtifactAvailable: false,
  clinicalValidation: false,
  clinicalReleaseAuthorized: false,
  expectedVersions: Object.freeze({
    model: "cal-0.9.3",
    "report-template": "perl-clinician-report/1.0",
    disclaimer: "ff-clinical-disclaimer/draft-2026-08",
    "state-schema": "sandbox-state/49",
    "release-evaluator": "deterministic-offline-v2"
  }),
  expectedPolicyHash: "23bc876878f97ad8add0db966d2d386e44475da3670e45f1f73d2d043f9455f9",
  caseSet: Object.freeze({
    id: "perl-synthetic-rehearsal-2026-08-v1",
    version: "1.0.0"
  }),
  sourceFiles: Object.freeze(files.map(([path, expectedHash]) => Object.freeze({ path, expectedHash }))),
  claimBoundary: ROLLBACK_REHEARSAL_BOUNDARY
});

export function rollbackManifestHash(manifest = LOCAL_LAST_KNOWN_GOOD) {
  return createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
}

export function validateRollbackManifest(manifest = LOCAL_LAST_KNOWN_GOOD) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return ["Rollback manifest is required."];
  if (!/^perl-local-lkg-\d{4}-\d{2}-\d{2}$/.test(String(manifest.id || ""))) errors.push("Rollback manifest ID is invalid.");
  if (!/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(String(manifest.version || ""))) errors.push("Rollback manifest version is invalid.");
  if (manifest.status !== "local-engineering-baseline") errors.push("Rollback manifest must be a local engineering baseline.");
  if (manifest.artifactRepository !== "working-tree-only" || manifest.deployableArtifactAvailable !== false) errors.push("Local rollback manifest must not claim a deployable artifact repository.");
  if (manifest.clinicalValidation !== false || manifest.clinicalReleaseAuthorized !== false) errors.push("Rollback manifest must deny clinical validation and release authority.");
  const requiredVersions = ["model", "report-template", "disclaimer", "state-schema", "release-evaluator"];
  if (requiredVersions.some(key => typeof manifest.expectedVersions?.[key] !== "string" || manifest.expectedVersions[key].length < 2)) errors.push("Rollback manifest is missing a required runtime version.");
  if (!/^[a-f0-9]{64}$/.test(String(manifest.expectedPolicyHash || ""))) errors.push("Rollback manifest policy hash is invalid.");
  if (!manifest.caseSet?.id || !/^\d+\.\d+\.\d+$/.test(String(manifest.caseSet?.version || ""))) errors.push("Rollback manifest case-set identity is invalid.");
  if (!Array.isArray(manifest.sourceFiles) || manifest.sourceFiles.length < 10) errors.push("Rollback manifest requires a bounded source-file inventory.");
  const paths = new Set();
  for (const file of manifest.sourceFiles || []) {
    if (!/^(?:src|schemas)\/[A-Za-z0-9._/-]+$|^[A-Za-z0-9._-]+$/.test(String(file?.path || "")) || String(file.path).includes("..")) errors.push("Rollback manifest contains an unsafe source path.");
    if (!/^[a-f0-9]{64}$/.test(String(file?.expectedHash || ""))) errors.push(`Rollback manifest hash is invalid for ${file?.path || "unknown file"}.`);
    if (paths.has(file?.path)) errors.push(`Rollback manifest repeats ${file.path}.`);
    paths.add(file?.path);
  }
  if (String(manifest.claimBoundary || "").length < 120 || !/does not restore a deployable artifact/i.test(manifest.claimBoundary)) errors.push("Rollback manifest claim boundary is incomplete.");
  return [...new Set(errors)];
}
