import { useState, useRef } from 'react';
import './Dashboard.css';
import logo from '../assets/dn.png';
import bgImage from '../assets/background.png';
import robotImg from '../assets/robot.png';

export default function Dashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [resultTab, setResultTab] = useState('diagnostic');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  
  // Real functional states
  const [patients, setPatients] = useState([
    { id: 1, initial: 'J', name: 'Juliette R.', age: 19, date: "Aujourd'hui", status: 'En amélioration', statusClass: 'improving' },
    { id: 2, initial: 'S', name: 'Sophie L.', age: 32, date: 'Il y a 2 jours', status: 'Analyse prioritaire', statusClass: 'warning' },
    { id: 3, initial: 'M', name: 'Marc D.', age: 45, date: 'Il y a 1 mois', status: 'Stable', statusClass: 'stable' }
  ]);
  
  const [pdfs, setPdfs] = useState([
    { id: 1, name: "Fitzpatrick's Dermatology, 9th Edition", size: "45 MB", type: "Base de données internationale", status: "Intégré à 100%", date: "Il y a 1 mois" },
    { id: 2, name: "Dermatology - Bolognia (Vol 1 & 2)", size: "112 MB", type: "Atlas clinique", status: "Intégré à 100%", date: "Il y a 2 semaines" },
    { id: 3, name: "Journal of Investigative Dermatology - 2025", size: "8 MB", type: "Publications récentes", status: "Intégré à 100%", date: "Il y a 3 jours" }
  ]);

  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  const [newPatientData, setNewPatientData] = useState({ name: '', age: '' });

  const [isPdfUploading, setIsPdfUploading] = useState(false);
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  const handleImageUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage({
        url: URL.createObjectURL(file),
        name: file.name,
        size: file.size
      });
      setAnalysisResult(null); // Reset previous results on new upload
    }
  };

  const handlePdfUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsPdfUploading(true);
      setTimeout(() => {
        setIsPdfUploading(false);
        const newPdf = {
          id: Date.now(),
          name: file.name,
          size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
          type: "Document importé",
          status: "Intégré à 100%",
          date: "À l'instant"
        };
        setPdfs([newPdf, ...pdfs]);
      }, 2500);
    }
  };

  const handleAddPatient = (e) => {
    e.preventDefault();
    if (!newPatientData.name) return;
    
    const newPatient = {
      id: Date.now(),
      initial: newPatientData.name.charAt(0).toUpperCase(),
      name: newPatientData.name,
      age: newPatientData.age || 0,
      date: "À l'instant",
      status: "Nouveau dossier",
      statusClass: "stable"
    };
    
    setPatients([newPatient, ...patients]);
    setIsNewPatientModalOpen(false);
    setNewPatientData({ name: '', age: '' });
  };

  // Advanced Deterministic Generator
  const generateDynamicAnalysis = (fileSize, fileName) => {
    const seed = fileSize + fileName.length; // Simple deterministic seed based on file
    
    const hydrations = ['65.2%', '78.4%', '82.1%', '54.9%', '91.0%', '72.3%'];
    const phs = ['5.12', '5.51', '5.80', '4.95', '5.34', '6.02'];
    const elasticities = ['68%', '85%', '54%', '72%', '91%', '45%'];
    const bioAges = ['24 ans', '34 ans', '42 ans', '29 ans', '51 ans', '19 ans'];
    
    const diagnoses = [
      "Analyse croisée avec ouvrages terminée. Léger déficit d'hydratation épidermique localisé. Aucune anomalie pigmentaire atypique.",
      "Recherche validée avec la base Bolognia. Signes de photovieillissement modéré. Élastose solaire naissante sur les zones exposées.",
      "Correspondance trouvée dans Fitzpatrick 9th Ed. Structure dermique excellente. Hyper-séborrhée légère sur la zone T.",
      "Analyse IA : Texture cutanée irrégulière détectée. Pores dilatés et micro-kystes visibles. Barrière cutanée légèrement altérée."
    ];
    
    const routines = [
      { matin: "Nettoyant doux, Sérum antioxydant (Vitamine C), Écran solaire SPF 50+.", soir: "Démaquillage hydratant, Émollient riche en céramides sur les zones identifiées." },
      { matin: "Gel purifiant à l'acide salicylique, Fluide hydratant matifiant.", soir: "Nettoyant doux, Rétinol 0.3% en alternance, Crème réparatrice." },
      { matin: "Eau micellaire, Sérum à l'acide hyaluronique, Protection solaire minérale.", soir: "Baume démaquillant, Crème riche nourrissante au beurre de karité." }
    ];

    const pick = (arr) => arr[seed % arr.length];

    return {
      hydration: pick(hydrations),
      ph: pick(phs),
      elasticity: pick(elasticities),
      aging: {
        bioAge: pick(bioAges),
        wrinkles: (seed % 2 === 0) ? 'Légères' : 'Modérées',
        collagenLoss: (10 + (seed % 20)) + '%',
        details: "Analyse volumétrique terminée. Les marqueurs de vieillissement correspondent au profil biologique calculé par l'IA."
      },
      diagnosis: pick(diagnoses),
      recommendation: "Prescription suggérée : " + (seed % 2 === 0 ? "Protocole hydratation intense" : "Protocole anti-âge préventif"),
      routine: pick(routines)
    };
  };

  const startAnalysis = () => {
    if (!selectedImage) {
      alert("Veuillez d'abord importer une photo.");
      return;
    }
    setAnalysisResult(null);
    setResultTab('diagnostic');
    setIsAnalyzing(true);
    
    setTimeout(() => {
      setIsAnalyzing(false);
      setAnalysisResult(generateDynamicAnalysis(selectedImage.size, selectedImage.name));
    }, 2500);
  };

  const tabs = [
    { id: 'dashboard', label: 'Tableau de bord' },
    { id: 'patients', label: 'Liste Patients' },
    { id: 'pdf_knowledge', label: 'Connaissances PDF' },
    { id: 'settings', label: 'Paramètres' },
  ];

  // Le Scanner combiné
  const renderScannerCard = () => (
    <div className="unified-scanner-card animate-fade-in">
      <div className="card-header">
        <h2>ANALYSE <span className="brand-light">DERMATOLOGIQUE</span></h2>
      </div>
      <p className="card-description">
        Importez ou prenez une photo directe. Le robot assistant croisera les données avec la littérature mondiale.
      </p>
      
      <div className="scanner-body">
        
        {/* Colonne 1: Uploader compact */}
        <div className="upload-column glass-panel">
          <div className="upload-container compact" onClick={() => fileInputRef.current.click()}>
            {selectedImage ? (
              <div className="uploaded-image-wrapper">
                <img src={selectedImage.url} alt="Scan preview" className="uploaded-image" />
                {isAnalyzing && <div className="scan-laser"></div>}
              </div>
            ) : (
              <div className="upload-placeholder">
                <div className="upload-icon-ring">
                  <span className="upload-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                  </span>
                </div>
                <h3>Photo</h3>
                <span className="upload-subtext">Caméra ou Galerie</span>
              </div>
            )}
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleImageUpload} 
            />
          </div>
          {selectedImage && (
            <div className="upload-actions">
              <button className="change-photo-btn" onClick={() => fileInputRef.current.click()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', verticalAlign: 'middle'}}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                Changer de photo
              </button>
              <button className="save-patient-btn" onClick={() => setIsNewPatientModalOpen(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', verticalAlign: 'middle'}}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                Enregistrer ce(tte) patient(e)
              </button>
            </div>
          )}
        </div>

        {/* Colonne 2: Résultats de l'analyse */}
        <div className="results-column glass-panel">
          {isAnalyzing ? (
            <div className="analyzing-state">
              <div className="spinner"></div>
              <p className="scanning-text">Consultation de la littérature mondiale en cours...</p>
            </div>
          ) : analysisResult ? (
            <div className="analysis-results animate-fade-in">
              <div className="result-tabs">
                <button 
                  className={`result-tab ${resultTab === 'diagnostic' ? 'active' : ''}`}
                  onClick={() => setResultTab('diagnostic')}
                >
                  DIAGNOSTIC
                </button>
                <button 
                  className={`result-tab ${resultTab === 'traitement' ? 'active' : ''}`}
                  onClick={() => setResultTab('traitement')}
                >
                  TRAITEMENT
                </button>
              </div>

              {resultTab === 'diagnostic' && (
                <div className="tab-content animate-fade-in">
                  <h3 className="results-title">RÉSULTATS BIOMÉTRIQUES</h3>
                  <div className="metrics-grid">
                    <div className="metric-box">
                      <span className="metric-label">HYDRATATION</span>
                      <span className="metric-value">{analysisResult.hydration}</span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">PH DERMIQUE</span>
                      <span className="metric-value">{analysisResult.ph}</span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">ÉLASTICITÉ</span>
                      <span className="metric-value">{analysisResult.elasticity}</span>
                    </div>
                  </div>
                  
                  <div className="aging-analysis">
                    <h4>VIEILLISSEMENT CUTANÉ</h4>
                    <div className="aging-stats">
                      <div className="aging-stat"><span>Âge Biologique</span><strong>{analysisResult.aging.bioAge}</strong></div>
                      <div className="aging-stat"><span>Rides & Ridules</span><strong>{analysisResult.aging.wrinkles}</strong></div>
                      <div className="aging-stat"><span>Perte Collagène</span><strong>{analysisResult.aging.collagenLoss}</strong></div>
                    </div>
                    <p className="aging-details">{analysisResult.aging.details}</p>
                  </div>

                  <div className="ai-diagnosis">
                    <h4>DIAGNOSTIC CLINIQUE</h4>
                    <p>{analysisResult.diagnosis}</p>
                  </div>
                </div>
              )}

              {resultTab === 'traitement' && (
                <div className="tab-content animate-fade-in">
                  <div className="ai-recommendation">
                    <h4>RECOMMANDATIONS IA</h4>
                    <p>{analysisResult.recommendation}</p>
                  </div>
                  <div className="treatment-details">
                    <h4>ROUTINE SUGGÉRÉE</h4>
                    <ul>
                      <li><strong>Matin :</strong> {analysisResult.routine.matin}</li>
                      <li><strong>Soir :</strong> {analysisResult.routine.soir}</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="waiting-state">
              <span className="waiting-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
              </span>
              <p>L'analyse détaillée du patient apparaîtra ici.</p>
            </div>
          )}
        </div>

        {/* Colonne 3: Robot & CTA */}
        <div className={`robot-side glass-panel ${isAnalyzing ? 'scanning-active' : ''}`}>
          <div className="robot-dialogue">
            <p>
              {isAnalyzing 
                ? "Recherche de correspondances cliniques..." 
                : analysisResult
                  ? "Analyse terminée ! Consultez le rapport détaillé."
                  : selectedImage 
                    ? "Image reçue ! Prêt à croiser les données." 
                    : "Bonjour Dr. Desouches ! Je suis prêt."}
            </p>
          </div>
          <img src={robotImg} alt="DermaNova Assistant Robot" className={`robot-image ${isAnalyzing ? 'floating' : ''}`} />
          <button 
            className={`start-analysis-btn ${isAnalyzing ? 'analyzing' : ''} ${analysisResult ? 'success' : ''}`} 
            onClick={startAnalysis}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? "ANALYSE EN COURS..." : analysisResult ? "NOUVELLE ANALYSE" : "DÉMARRER L'ANALYSE"}
          </button>
        </div>
      </div>
    </div>
  );

  const renderPatientsList = () => (
    <div className="content-card animate-fade-in">
      <div className="card-header patients">
        <div className="title-area">
          <h2>LISTE DES <span className="brand-light">PATIENTS</span></h2>
          <p className="card-description">
            Sélectionnez un patient pour accéder à son dossier complet et ses analyses.
          </p>
        </div>
        <button className="premium-btn-small" onClick={() => setIsNewPatientModalOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px', verticalAlign: 'middle'}}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Nouveau Patient
        </button>
      </div>
      
      <div className="patients-list glass-panel" style={{padding: '1.5rem'}}>
        {patients.map(patient => (
          <div key={patient.id} className="patient-list-item">
            <div className="patient-avatar-small">{patient.initial}</div>
            <div className="patient-info-row">
              <h3>{patient.name}</h3>
              <span className="patient-age">{patient.age} ans</span>
            </div>
            <div className="patient-date">{patient.date}</div>
            <span className={`status-badge ${patient.statusClass}`}>{patient.status}</span>
            <button className="view-btn-icon">➔</button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPdfKnowledge = () => (
    <div className="content-card animate-fade-in">
      <div className="card-header">
        <h2>CONNAISSANCES <span className="brand-light">PDF & IA</span></h2>
      </div>
      <p className="card-description">
        Alimentez le cerveau de DermaNova. Importez des ouvrages internationaux pour affiner la précision des diagnostics.
      </p>

      <div className="pdf-knowledge-layout">
        <div className="pdf-upload-section glass-panel-glow" onClick={() => pdfInputRef.current.click()}>
          <div className="upload-icon-ring pdf-icon">
            <span className="upload-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </span>
          </div>
          <h3>Importer un Ouvrage (PDF)</h3>
          <p>L'IA lira et intégrera ces connaissances instantanément</p>
          <input 
            type="file" 
            accept=".pdf" 
            ref={pdfInputRef} 
            style={{ display: 'none' }} 
            onChange={handlePdfUpload} 
          />
          {isPdfUploading && <p className="uploading-text">Ingestion par l'IA en cours...</p>}
        </div>

        <div className="pdf-library">
          <h3>Ouvrages intégrés récemment</h3>
          <ul className="library-list">
            {pdfs.map(pdf => (
              <li key={pdf.id} className="library-item glass-panel">
                <span className="book-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                </span>
                <div className="book-info">
                  <h4>{pdf.name}</h4>
                  <span>{pdf.size} • {pdf.type} • {pdf.status}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="glass-panel content-card animate-fade-in">
      <div className="card-header">
        <h2>PARAMÈTRES <span className="brand-light">SYSTÈME</span></h2>
      </div>
      <p className="card-description">
        Configurez votre clinique et l'intelligence artificielle de DermaNova.
      </p>

      <div className="settings-grid">
        <div className="setting-group glass-panel">
          <h3>Préférences de l'Assistant Robot</h3>
          <label className="setting-toggle">
            <span>Analyse biométrique de haute précision (plus lent)</span>
            <input type="checkbox" defaultChecked />
          </label>
          <label className="setting-toggle">
            <span>Prioriser la littérature récemment ajoutée (PDF)</span>
            <input type="checkbox" defaultChecked />
          </label>
        </div>

        <div className="setting-group glass-panel">
          <h3>Interface & Compte</h3>
          <label className="setting-toggle">
            <span>Mode sombre premium (Activé par défaut)</span>
            <input type="checkbox" defaultChecked disabled />
          </label>
          <div className="setting-action">
            <span>Clinique : Institut Dermatologique de Paris</span>
            <button className="premium-btn-small outline">Modifier</button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="dashboard-container" style={{ backgroundImage: `url(${bgImage})` }}>
      <div className="dashboard-overlay"></div>
      
      <div className="dashboard-layout">
        
        {/* Sidebar à gauche */}
        <aside className="main-sidebar glass-panel">
          <div className="sidebar-logo-container">
            <img src={logo} alt="DermaNova Logo" className="sidebar-logo" />
          </div>
          
          <nav className="sidebar-nav">
            {tabs.map(tab => (
              <button 
                key={tab.id}
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="user-profile-card">
              <div className="user-avatar-placeholder">D</div>
              <div className="user-info">
                <span className="user-name">Dr. Desouches</span>
                <span className="user-role">Dermatologue</span>
              </div>
              <button className="logout-btn-icon" onClick={onLogout} title="Se déconnecter">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            </div>
          </div>
        </aside>

        {/* Contenu principal */}
        <div className="dashboard-content">
          <main className="dashboard-main full-height">
            {activeTab === 'dashboard' && (
              <div className="dashboard-grid layout-single">
                {renderScannerCard()}
              </div>
            )}
            
            {activeTab === 'patients' && (
              <div className="layout-single">
                {renderPatientsList()}
              </div>
            )}

            {activeTab === 'pdf_knowledge' && (
              <div className="layout-single">
                {renderPdfKnowledge()}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="layout-single">
                {renderSettings()}
              </div>
            )}
          </main>
        </div>
        
      </div>

      {/* Modal Nouveau Patient */}
      {isNewPatientModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Nouveau Patient</h3>
            <form className="modal-form" onSubmit={handleAddPatient}>
              <input 
                type="text" 
                placeholder="Nom complet (ex: Jean Dupont)" 
                value={newPatientData.name}
                onChange={e => setNewPatientData({...newPatientData, name: e.target.value})}
                autoFocus
                required
              />
              <input 
                type="number" 
                placeholder="Âge" 
                value={newPatientData.age}
                onChange={e => setNewPatientData({...newPatientData, age: e.target.value})}
                required
              />
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsNewPatientModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn-submit">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
